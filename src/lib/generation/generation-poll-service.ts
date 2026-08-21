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
}) {
  const requestId = safeId();
  const startedAt = Date.now();
  const useTestMode = String(process.env.USE_TEST_MODE || '').toLowerCase() === 'true';
  const testImageUrl = String(process.env.TEST_IMAGE_URL || '').trim();
  const { provider: providerName, providerJobId } = decodeProviderJobId(
    args.encodedProviderJobId,
  );

  if (useTestMode) {
    console.info('[op:generation:poll]', {
      requestId,
      provider: 'test',
      providerJobId,
      status: 'succeeded',
      images: testImageUrl ? 1 : 0,
      elapsedMs: Date.now() - startedAt,
    });
    return {
      status: 200,
      body: {
        provider: 'test',
        providerJobId,
        status: 'succeeded',
        images: testImageUrl ? [testImageUrl] : [],
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

  const result = await provider.poll(providerJobId);
  console.info('[op:generation:poll:done]', {
    requestId,
    provider: providerName,
    providerJobId,
    status: result.status,
    images: Array.isArray(result.images) ? result.images.length : 0,
    hasError: Boolean(result.error),
    elapsedMs: Date.now() - startedAt,
  });
  return {
    status: 200,
    body: { provider: providerName, ...result },
  };
}