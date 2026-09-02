import { getDb } from '~/db/client';
import type { AssetOwnerIdentity } from '~/lib/assets/asset-owner';
import { getImageAssetsBucket } from '~/lib/assets/cloudflare-r2';
import {
  persistGeneratedImageOutputs,
  resolveGenerationImageAssetInputs,
} from '~/lib/assets/asset-service';
import {
  consumeGenerationCredits,
  getGenerationCreditsRejection,
  type GenerationCreditsContext,
} from '~/lib/generation/generation-credits-policy';
import {
  recordGenerationJob,
  updateGenerationJob,
} from '~/lib/generation/generation-job-record';
import { getGenerationImageInputs, MAX_GENERATION_REFERENCE_IMAGES } from '~/lib/generation/image-input';
import { resolveGenerationProvider } from '~/lib/generation/provider-runtime';
import {
  encodeProviderJobId,
  getDefaultProviderName,
} from '~/lib/generation/registry';
import type {
  GenerationApiResponseDto,
  GenerationCreateRequestDto,
  GenerationCreateResponseDto,
} from '~/lib/generation/generation-dto';

export type GenerationServiceResult<TBody> = {
  status: number;
  body: TBody;
  headers?: Record<string, string>;
};

type GenerationCreateRequest = Partial<GenerationCreateRequestDto>;

type CreateGenerationContext = {
  cookieHeader: string;
  /** Trusted authenticated or signed-cookie asset identity resolved by the route. */
  assetOwner: AssetOwnerIdentity;
};

function safeId() {
  return (
    (globalThis as any).crypto?.randomUUID?.() ||
    `req_${Date.now()}_${Math.random().toString(16).slice(2)}`
  );
}

function normalizeRequest(payload: unknown): GenerationCreateRequest {
  if (typeof payload !== 'object' || payload === null || Array.isArray(payload)) {
    return {};
  }
  return payload as GenerationCreateRequest;
}

function createCreditsContext(args: {
  internal: boolean;
  context: CreateGenerationContext;
  requestedCount: number;
}): GenerationCreditsContext {
  return {
    internal: args.internal,
    userId: args.context.assetOwner.ownerId || '',
    cookieHeader: args.context.cookieHeader,
    requestedCount: args.requestedCount,
  };
}

function creditsHeaders(context: GenerationCreditsContext) {
  const cookie = consumeGenerationCredits(context);
  return cookie ? { 'set-cookie': cookie } : undefined;
}

export async function createGeneration(
  payload: unknown,
  context: CreateGenerationContext,
): Promise<
  GenerationServiceResult<
    GenerationApiResponseDto<GenerationCreateResponseDto>
  >
> {
  const requestId = safeId();
  const startedAt = Date.now();
  const useTestMode = String(process.env.USE_TEST_MODE || '').toLowerCase() === 'true';
  const testImageUrl = String(process.env.TEST_IMAGE_URL || '').trim();
  const request = normalizeRequest(payload);

  const prompt = String(request.prompt || '').trim();
  if (!prompt) {
    return { status: 400, body: { error: 'Missing prompt' } };
  }

  const apiKey = typeof request.apiKey === 'string' ? request.apiKey.trim() : '';
  const providerName = String(request.provider || getDefaultProviderName()).toLowerCase();
  const usesClientApiKey =
    Boolean(apiKey) &&
    (providerName === 'atlascloud' || providerName === 'replicate');
  const requestedCount =
    typeof request.count === 'number' && Number.isFinite(request.count)
      ? Math.min(10, Math.max(1, Math.floor(request.count)))
      : 1;
  const normalizedReferenceImages = getGenerationImageInputs(request);
  if (normalizedReferenceImages.length > MAX_GENERATION_REFERENCE_IMAGES) {
    return {
      status: 400,
      body: {
        error: `A maximum of ${MAX_GENERATION_REFERENCE_IMAGES} reference images is supported.`,
      },
    };
  }
  const creditsContext = createCreditsContext({
    internal: !usesClientApiKey,
    context,
    requestedCount,
  });
  const creditsRejection = getGenerationCreditsRejection(creditsContext);
  if (creditsRejection) {
    return { status: 429, body: creditsRejection };
  }

  const db = getDb();
  if (!db) {
    return { status: 503, body: { error: 'Database not configured' } };
  }
  const assetOwnerId = context.assetOwner.ownerId;
  if (!assetOwnerId || !context.assetOwner.authorizedOwnerIds.includes(assetOwnerId)) {
    return { status: 503, body: { error: 'Trusted image asset ownership is unavailable.' } };
  }
  try {
    await getImageAssetsBucket();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Image asset storage is not configured.';
    return { status: 503, body: { error: message } };
  }

  let providerImageInputs: string[];
  try {
    providerImageInputs = await resolveGenerationImageAssetInputs({
      db,
      requesterOwnerIds: context.assetOwner.authorizedOwnerIds,
      images: normalizedReferenceImages,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Unable to read reference image assets.';
    return { status: 400, body: { error: message } };
  }

  if (useTestMode) {
    const id = safeId();
    try {
      await recordGenerationJob({
        db,
        provider: 'test',
        providerJobId: id,
        ownerId: assetOwnerId,
        requestedCount,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to record generation job.';
      return { status: 500, body: { error: message } };
    }
    console.info('[op:generation:create]', {
      requestId,
      provider: 'test',
      testImageUrl: Boolean(testImageUrl),
      promptLen: prompt.length,
      aspectRatio: request.aspectRatio,
      quality: request.quality,
      count: requestedCount,
      elapsedMs: Date.now() - startedAt,
    });
    return {
      status: 200,
      headers: creditsHeaders(creditsContext),
      body: {
        provider: 'test',
        providerJobId: encodeProviderJobId('test', id),
        status: 'queued',
      },
    };
  }

  console.info('[op:generation:create:start]', {
    requestId,
    provider: providerName,
    hasApiKeyOverride: Boolean(apiKey),
    model: request.model,
    aspectRatio: request.aspectRatio,
    quality: request.quality,
    count: request.count,
    referenceImageCount: normalizedReferenceImages.length,
    promptLen: prompt.length,
    promptHasCommerceContract: prompt.includes('Non-negotiable commerce asset contract:'),
    promptHasUserPromptMarker: prompt.includes('User prompt, verbatim:'),
  });

  const provider = resolveGenerationProvider(providerName, apiKey);
  if (!provider) {
    return {
      status: 400,
      body: { error: `Unknown provider: ${providerName}` },
    };
  }

  let createdProviderJobId: string | null = null;
  try {
    const result = await provider.create({
      prompt,
      negativePrompt: request.negativePrompt,
      model: request.model,
      aspectRatio: request.aspectRatio,
      quality: request.quality,
      inputFidelity: request.inputFidelity,
      count: requestedCount,
      referenceImages: providerImageInputs,
      imageInputs: undefined,
    });
    createdProviderJobId = result.providerJobId;
    await recordGenerationJob({
      db,
      provider: providerName,
      providerJobId: result.providerJobId,
      ownerId: assetOwnerId,
      requestedCount,
      status: result.status === 'succeeded' ? 'running' : result.status,
    });
    const persisted =
      result.status === 'succeeded'
        ? await persistGeneratedImageOutputs({
            db,
            ownerId: assetOwnerId,
            provider: providerName,
            providerJobId: result.providerJobId,
            images: (result.images ?? []).slice(0, requestedCount),
          })
        : undefined;
    if (result.status === 'succeeded' && !persisted?.urls.length) {
      throw new Error('Generation succeeded but returned no persistable images.');
    }
    await updateGenerationJob({
      db,
      provider: providerName,
      providerJobId: result.providerJobId,
      ownerId: assetOwnerId,
      status: result.status,
      resultAssetIds: persisted?.assetIds,
    });

    console.info('[op:generation:create:done]', {
      requestId,
      provider: providerName,
      status: result.status,
      providerJobId: result.providerJobId,
      elapsedMs: Date.now() - startedAt,
    });

    return {
      status: 200,
      headers:
        result.status === 'failed' ? undefined : creditsHeaders(creditsContext),
      body: {
        provider: providerName,
        providerJobId: encodeProviderJobId(
          providerName,
          result.providerJobId,
        ),
        status: result.status,
        images: persisted?.urls,
      },
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error && error.message ? error.message : 'create failed';
    if (createdProviderJobId) {
      await updateGenerationJob({
        db,
        provider: providerName,
        providerJobId: createdProviderJobId,
        ownerId: assetOwnerId,
        status: 'failed',
        error: message,
      }).catch(() => undefined);
    }
    console.error('[op:generation:create:error]', {
      requestId,
      provider: providerName,
      elapsedMs: Date.now() - startedAt,
      error: message,
    });
    return { status: 500, body: { error: message } };
  }
}