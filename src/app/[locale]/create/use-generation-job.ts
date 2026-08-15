import { useCallback, useEffect, useMemo, useState } from 'react';
import { getOrCreateUserId } from '~/lib/credits/fingerprint';
import { localeApiPath } from '~/lib/locale-api-path';
import type { GenerationUiState } from './types';

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

type StartGenerationParams = {
  prompt: string;
  provider: string;
  apiKey?: string;
  model: string;
  aspectRatio: string;
  quality: string;
  count: number;
};

type UseGenerationJobOptions = {
  locale: string;
  provider: string;
  getApiKeyOverride(provider: string): string;
  messages: {
    missingPrompt: string;
    createFailed: string;
    generationFailed: string;
    pollingFailed: string;
  };
};

export function useGenerationJob({
  locale,
  provider,
  getApiKeyOverride,
  messages,
}: UseGenerationJobOptions) {
  const [uiState, setUiState] = useState<GenerationUiState>('idle');
  const [providerJobId, setProviderJobId] = useState<string | null>(null);
  const [images, setImages] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  const resetGeneration = useCallback(() => {
    setError(null);
    setUiState('idle');
    setProviderJobId(null);
    setImages([]);
  }, []);

  const startGeneration = useCallback(
    async (params: StartGenerationParams) => {
      const prompt = params.prompt.trim();
      if (!prompt) {
        setError(messages.missingPrompt);
        return;
      }

      setError(null);
      setUiState('queued');
      setImages([]);

      try {
        const res = await fetch(localeApiPath(locale, '/api/generations'), {
          method: 'POST',
          headers: { 'content-type': 'application/json', 'x-op-user-id': getOrCreateUserId() },
          body: JSON.stringify({
            provider: params.provider === 'internal' ? undefined : params.provider,
            prompt,
            apiKey: params.provider === 'internal' ? undefined : params.apiKey || undefined,
            model: params.model,
            aspectRatio: params.aspectRatio,
            quality: params.quality,
            count: params.count,
          }),
        }).then((response) => response.json());

        if (res?.error) throw new Error(res.error);
        setProviderJobId(res.providerJobId);
        setUiState(res.status || 'queued');
      } catch (e: unknown) {
        setUiState('failed');
        setError(getErrorMessage(e, messages.createFailed));
      }
    },
    [locale, messages.createFailed, messages.missingPrompt],
  );

  useEffect(() => {
    if (!providerJobId) return;
    if (uiState !== 'queued' && uiState !== 'running') return;

    let cancelled = false;
    const tick = async () => {
      try {
        const encoded = providerJobId || '';
        const providerFromJob = encoded.includes(':') ? encoded.slice(0, encoded.indexOf(':')) : provider;
        const key = getApiKeyOverride(providerFromJob);
        const res = await fetch(localeApiPath(locale, `/api/generations/${encodeURIComponent(providerJobId)}`), {
          cache: 'no-store',
          headers: key ? { 'x-op-api-key': key } : undefined,
        }).then((response) => response.json());

        if (cancelled) return;
        if (res?.status === 'running' || res?.status === 'queued') {
          setUiState(res.status);
          return;
        }
        if (res?.status === 'succeeded') {
          setUiState('succeeded');
          setImages(Array.isArray(res.images) ? res.images : []);
          return;
        }
        setUiState('failed');
        setError(res?.error || messages.generationFailed);
      } catch (e: unknown) {
        if (cancelled) return;
        setUiState('failed');
        setError(getErrorMessage(e, messages.pollingFailed));
      }
    };

    const interval = setInterval(tick, 2000);
    tick();
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [locale, provider, providerJobId, uiState, getApiKeyOverride, messages.generationFailed, messages.pollingFailed]);

  const canGenerate = useMemo(
    () => uiState === 'idle' || uiState === 'failed' || uiState === 'succeeded',
    [uiState],
  );

  return {
    uiState,
    setUiState,
    providerJobId,
    setProviderJobId,
    images,
    setImages,
    error,
    setError,
    canGenerate,
    resetGeneration,
    startGeneration,
  };
}