import {
  consumeGenerationCredits,
  getGenerationCreditsRejection,
  type GenerationCreditsContext,
} from '~/lib/generation/generation-credits-policy';
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
  userId: string;
};

function safeId() {
  return (
    (globalThis as any).crypto?.randomUUID?.() ||
    `req_${Date.now()}_${Math.random().toString(16).slice(2)}`
  );
}

function preview(text: string, max = 120) {
  const oneLine = String(text || '').replace(/\s+/g, ' ').trim();
  return oneLine.length <= max ? oneLine : `${oneLine.slice(0, max)}…`;
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
    userId: args.context.userId,
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
      ? Math.max(1, Math.floor(request.count))
      : 1;
  const creditsContext = createCreditsContext({
    internal: !usesClientApiKey,
    context,
    requestedCount,
  });
  const creditsRejection = getGenerationCreditsRejection(creditsContext);
  if (creditsRejection) {
    return { status: 429, body: creditsRejection };
  }

  if (useTestMode) {
    const id = safeId();
    console.info('[op:generation:create]', {
      requestId,
      provider: 'test',
      testImageUrl: Boolean(testImageUrl),
      promptLen: prompt.length,
      promptPreview: preview(prompt),
      aspectRatio: request.aspectRatio,
      quality: request.quality,
      count: request.count,
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
    promptLen: prompt.length,
    promptPreview: preview(prompt),
  });

  const provider = resolveGenerationProvider(providerName, apiKey);
  if (!provider) {
    return {
      status: 400,
      body: { error: `Unknown provider: ${providerName}` },
    };
  }

  try {
    const result = await provider.create({
      prompt,
      negativePrompt: request.negativePrompt,
      model: request.model,
      aspectRatio: request.aspectRatio,
      quality: request.quality,
      count: request.count,
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
        images: result.images,
      },
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error && error.message ? error.message : 'create failed';
    console.error('[op:generation:create:error]', {
      requestId,
      provider: providerName,
      elapsedMs: Date.now() - startedAt,
      error: message,
    });
    return { status: 500, body: { error: message } };
  }
}