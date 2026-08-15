import { useCallback, useEffect, useRef, useState } from 'react';

import { BYOK_PROVIDER_NAMES } from '~/lib/generation/provider-names';

function storageKey(provider: string) {
  return `op_apiKey_${provider}`;
}

export function useProviderApiKeys() {
  const [apiKeyByProvider, setApiKeyByProvider] = useState<Record<string, string>>({});
  const apiKeyByProviderRef = useRef<Record<string, string>>({});

  useEffect(() => {
    try {
      const map: Record<string, string> = {};
      for (const provider of BYOK_PROVIDER_NAMES) {
        map[provider] = localStorage.getItem(storageKey(provider)) || '';
      }
      setApiKeyByProvider(map);
    } catch {
      // Browser storage can be unavailable in private/restricted contexts.
    }
  }, []);

  useEffect(() => {
    apiKeyByProviderRef.current = apiKeyByProvider;
  }, [apiKeyByProvider]);

  const getApiKeyOverride = useCallback((provider: string) => {
    return (apiKeyByProviderRef.current[provider] || '').trim();
  }, []);

  const saveApiKeyOverride = useCallback((provider: string, value: string) => {
    const trimmed = value.trim();
    try {
      if (trimmed) localStorage.setItem(storageKey(provider), trimmed);
      else localStorage.removeItem(storageKey(provider));
    } catch {
      // Keep in-memory state even if persistence fails.
    }
    setApiKeyByProvider((prev) => ({ ...prev, [provider]: trimmed }));
  }, []);

  const clearApiKeyOverride = useCallback((provider: string) => {
    try {
      localStorage.removeItem(storageKey(provider));
    } catch {
      // Keep in-memory state even if persistence fails.
    }
    setApiKeyByProvider((prev) => ({ ...prev, [provider]: '' }));
  }, []);

  return {
    apiKeyByProvider,
    getApiKeyOverride,
    saveApiKeyOverride,
    clearApiKeyOverride,
  };
}