export const BYOK_PROVIDER_NAMES = ['atlascloud', 'replicate'] as const;

export type ByokProviderName = (typeof BYOK_PROVIDER_NAMES)[number];

export function isByokProviderName(provider: string): provider is ByokProviderName {
  return (BYOK_PROVIDER_NAMES as readonly string[]).includes(provider);
}