import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  createGeneration,
  pollGeneration,
  providerFromGenerationJob,
  type CreateGenerationRequest,
} from './create-api';
import type { GenerationUiState } from './types';

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error && error.message ? error.message : fallback;
}

type StartGenerationParams = CreateGenerationRequest;

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

  const restoreGeneration = useCallback(
    (snapshot: {
      providerJobId: string | null;
      images: string[];
    }) => {
      setError(null);
      setProviderJobId(snapshot.providerJobId);
      setImages(snapshot.images);
      setUiState(snapshot.images.length ? 'succeeded' : 'idle');
    },
    [],
  );

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
        const result = await createGeneration(locale, {
          ...params,
          prompt,
        });
        setProviderJobId(result.providerJobId);
        setUiState(result.status);
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
        const providerFromJob = providerFromGenerationJob(
          providerJobId,
          provider,
        );
        const key = getApiKeyOverride(providerFromJob);
        const result = await pollGeneration(locale, providerJobId, key || undefined);

        if (cancelled) return;
        if (result.status === 'running' || result.status === 'queued') {
          setUiState(result.status);
          return;
        }
        if (result.status === 'succeeded') {
          setUiState('succeeded');
          setImages(result.images);
          return;
        }
        setUiState('failed');
        setError(result.error || messages.generationFailed);
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
    providerJobId,
    images,
    error,
    canGenerate,
    resetGeneration,
    restoreGeneration,
    startGeneration,
  };
}