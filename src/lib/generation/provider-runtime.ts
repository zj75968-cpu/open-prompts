import { createAtlascloudProviderWithOptions } from '~/lib/generation/providers/atlascloud';
import { createReplicateProviderWithOptions } from '~/lib/generation/providers/replicate';
import { isByokProviderName } from '~/lib/generation/provider-names';
import { getDefaultProviderName, getProviderRegistry } from '~/lib/generation/registry';
import type { ImageGenerationProvider } from '~/lib/generation/types';

function normalizeProviderName(providerName?: string): string {
  return String(providerName || '').trim().toLowerCase();
}

export function resolveGenerationProvider(
  providerName?: string,
  apiKey?: string,
): ImageGenerationProvider | undefined {
  const normalized = normalizeProviderName(providerName || getDefaultProviderName());
  const trimmedApiKey = String(apiKey || '').trim();

  if (trimmedApiKey && isByokProviderName(normalized)) {
    if (normalized === 'atlascloud') {
      return createAtlascloudProviderWithOptions({ apiKey: trimmedApiKey });
    }
    return createReplicateProviderWithOptions({ token: trimmedApiKey });
  }
  if (normalized === 'internal') {
    return getProviderRegistry()[getDefaultProviderName()];
  }
  return getProviderRegistry()[normalized];
}