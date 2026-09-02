import { getDb } from '~/db/client';
import type { AssetOwnerIdentity } from '~/lib/assets/asset-owner';
import { getImageAssetsBucket } from '~/lib/assets/cloudflare-r2';
import {
  getPersistedGenerationImageUrls,
  persistGeneratedImageOutputs,
} from '~/lib/assets/asset-service';
import type {
  GenerationApiResponseDto,
  GenerationPollResponseDto,
} from '~/lib/generation/generation-dto';
import {
  getGenerationJobRecord,
  updateGenerationJob,
} from '~/lib/generation/generation-job-record';
import { resolveGenerationProvider } from '~/lib/generation/provider-runtime';
import { decodeProviderJobId } from '~/lib/generation/registry';

function safeId() {
  return (
    (globalThis as any).crypto?.randomUUID?.() ||
    `req_${Date.now()}_${Math.random().toString(16).slice(2)}`
  );
}

export async function pollGeneration(args: {
  encodedProviderJobId: string;
  apiKey: string;
  assetOwner: AssetOwnerIdentity;
}): Promise<{
  status: number;
  body: GenerationApiResponseDto<GenerationPollResponseDto>;
}> {
  const requestId = safeId();
  const startedAt = Date.now();
  const useTestMode = String(process.env.USE_TEST_MODE || '').toLowerCase() === 'true';
  const testImageUrl = String(process.env.TEST_IMAGE_URL || '').trim();
  const { provider: providerName, providerJobId } = decodeProviderJobId(
    args.encodedProviderJobId,
  );
  const ownerId = args.assetOwner.ownerId;
  if (!ownerId || !args.assetOwner.authorizedOwnerIds.includes(ownerId)) {
    return { status: 404, body: { error: 'Generation job not found.' } };
  }

  const db = getDb();
  if (!db) return { status: 503, body: { error: 'Database not configured' } };
  try {
    await getImageAssetsBucket();
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Image asset storage is not configured.';
    return { status: 503, body: { error: message } };
  }

  const job = await getGenerationJobRecord(db, providerName, providerJobId);
  if (!job || !args.assetOwner.authorizedOwnerIds.includes(job.ownerId)) {
    return { status: 404, body: { error: 'Generation job not found.' } };
  }

  if (job.status === 'succeeded' && job.resultAssetIds.length) {
    const images = await getPersistedGenerationImageUrls({
      db,
      ownerId: job.ownerId,
      assetIds: job.resultAssetIds,
    });
    if (images?.length) {
      return {
        status: 200,
        body: {
          provider: providerName,
          providerJobId,
          status: 'succeeded',
          images,
        },
      };
    }
  }
  if (job.status === 'failed') {
    return {
      status: 200,
      body: {
        provider: providerName,
        providerJobId,
        status: 'failed',
        ...(job.error ? { error: job.error } : {}),
      },
    };
  }

  if (useTestMode) {
    const testStatus = testImageUrl ? 'succeeded' : 'failed';
    const testError = testImageUrl ? undefined : 'TEST_IMAGE_URL is not configured for test mode.';
    let persisted;
    if (testImageUrl) {
      try {
        persisted = await persistGeneratedImageOutputs({
          db,
          ownerId: job.ownerId,
          provider: 'test',
          providerJobId,
          images: [testImageUrl],
        });
      } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Generated image persistence failed.';
        if (/persistence is already in progress/i.test(message)) {
          return {
            status: 200,
            body: {
              provider: 'test',
              providerJobId,
              status: 'running',
            },
          };
        }
        return { status: 502, body: { error: message } };
      }
    }
    await updateGenerationJob({
      db,
      provider: 'test',
      providerJobId,
      ownerId: job.ownerId,
      status: testStatus,
      resultAssetIds: persisted?.assetIds,
      error: testError,
    });
    console.info('[op:generation:poll]', {
      requestId,
      provider: 'test',
      providerJobId,
      status: testStatus,
      images: persisted?.urls.length ?? 0,
      elapsedMs: Date.now() - startedAt,
    });
    return {
      status: 200,
      body: {
        provider: 'test',
        providerJobId,
        status: testStatus,
        ...(persisted ? { images: persisted.urls } : {}),
        ...(testError ? { error: testError } : {}),
      },
    };
  }

  const apiKey = args.apiKey.trim();
  console.info('[op:generation:poll:start]', {
    requestId,
    provider: providerName,
    providerJobId,
    hasApiKeyOverride: Boolean(apiKey),
  });
  const provider = resolveGenerationProvider(providerName, apiKey);
  if (!provider) {
    return {
      status: 400,
      body: { error: `Unknown provider: ${providerName}` },
    };
  }

  let result;
  try {
    result = await provider.poll(providerJobId);
  } catch (error: unknown) {
    const message = error instanceof Error && error.message ? error.message : 'Generation provider polling failed.';
    console.error('[op:generation:poll:error]', {
      requestId,
      provider: providerName,
      providerJobId,
      elapsedMs: Date.now() - startedAt,
      error: message,
    });
    return { status: 502, body: { error: message } };
  }

  console.info('[op:generation:poll:done]', {
    requestId,
    provider: providerName,
    providerJobId,
    status: result.status,
    images: Array.isArray(result.images) ? result.images.length : 0,
    hasError: Boolean(result.error),
    elapsedMs: Date.now() - startedAt,
  });
  if (result.status === 'failed' && result.error && /\bpoll failed\b/i.test(result.error)) {
    return { status: 502, body: { error: result.error } };
  }

  let persisted;
  if (result.status === 'succeeded') {
    try {
      persisted = await persistGeneratedImageOutputs({
        db,
        ownerId: job.ownerId,
        provider: providerName,
        providerJobId,
        images: (result.images ?? []).slice(0, job.requestedCount),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Generated image persistence failed.';
      if (/persistence is already in progress/i.test(message)) {
        return {
          status: 200,
          body: {
            provider: providerName,
            providerJobId,
            status: 'running',
          },
        };
      }
      console.error('[op:generation:persist:error]', {
        requestId,
        provider: providerName,
        providerJobId,
        error: message,
      });
      return { status: 502, body: { error: message } };
    }
    if (!persisted.urls.length) {
      return {
        status: 502,
        body: { error: 'Generation succeeded but returned no persistable images.' },
      };
    }
  }

  await updateGenerationJob({
    db,
    provider: providerName,
    providerJobId,
    ownerId: job.ownerId,
    status: result.status,
    resultAssetIds: persisted?.assetIds,
    error: result.error,
  });

  return {
    status: 200,
    body: {
      provider: providerName,
      providerJobId: result.providerJobId,
      status: result.status,
      ...(persisted ? { images: persisted.urls } : {}),
      ...(result.error ? { error: result.error } : {}),
    },
  };
}