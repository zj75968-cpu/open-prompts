import {
  createGenerationJob,
  pollGenerationJob,
} from '~/lib/generation/generation-api-client';
import {
  isGenerationErrorResponse,
  type GenerationCreateRequestDto,
  type GenerationPollResponseDto,
} from '~/lib/generation/generation-dto';
import { localeApiPath } from '~/lib/locale-api-path';
import type { GenerationUiState } from './types';

export type CreateGenerationRequest = Required<
  Pick<
    GenerationCreateRequestDto,
    'prompt' | 'provider' | 'model' | 'aspectRatio' | 'quality' | 'count'
  >
> & {
  apiKey?: string;
};

export type CreateGenerationResponse = {
  providerJobId: string | null;
  status: GenerationUiState;
  images: string[];
};

export type PollGenerationResponse = {
  status: GenerationUiState;
  images: string[];
  error: string | null;
};

function normalizeStatus(value: unknown, fallback: GenerationUiState): GenerationUiState {
  return value === 'idle' ||
    value === 'queued' ||
    value === 'running' ||
    value === 'succeeded' ||
    value === 'failed'
    ? value
    : fallback;
}

function generationErrorMessage(value: unknown, fallback: string): string {
  return isGenerationErrorResponse(value) && value.error ? value.error : fallback;
}

export async function createGeneration(
  locale: string,
  request: CreateGenerationRequest,
): Promise<CreateGenerationResponse> {
  const response = await createGenerationJob(locale, {
    provider: request.provider === 'internal' ? undefined : request.provider,
    prompt: request.prompt,
    apiKey:
      request.provider === 'internal' ? undefined : request.apiKey || undefined,
    model: request.model,
    aspectRatio: request.aspectRatio,
    quality: request.quality,
    count: request.count,
  });

  if (!response.ok || isGenerationErrorResponse(response.data)) {
    throw new Error(
      generationErrorMessage(
        response.data,
        `Generation request failed (${response.status})`,
      ),
    );
  }

  return {
    providerJobId: response.data.providerJobId || null,
    status: normalizeStatus(response.data.status, 'queued'),
    images: Array.isArray(response.data.images) ? response.data.images : [],
  };
}

export async function pollGeneration(
  locale: string,
  providerJobId: string,
  apiKey?: string,
): Promise<PollGenerationResponse> {
  const response = await pollGenerationJob(locale, providerJobId, apiKey);

  if (!response.ok) {
    throw new Error(
      generationErrorMessage(
        response.data,
        `Generation polling failed (${response.status})`,
      ),
    );
  }

  const payload = response.data as GenerationPollResponseDto;
  return {
    status: normalizeStatus(payload.status, 'failed'),
    images: Array.isArray(payload.images) ? payload.images : [],
    error: typeof payload.error === 'string' ? payload.error : null,
  };
}

export function providerFromGenerationJob(
  providerJobId: string,
  fallbackProvider: string,
) {
  const separatorIndex = providerJobId.indexOf(':');
  return separatorIndex > 0
    ? providerJobId.slice(0, separatorIndex)
    : fallbackProvider;
}

export function imageProxyUrl(locale: string, url: string) {
  const trimmed = String(url || '').trim();
  if (!trimmed) return '';
  if (trimmed.startsWith('/') && !trimmed.startsWith('//')) return trimmed;
  if (!/^https?:\/\//i.test(trimmed)) return trimmed;
  return `${localeApiPath(locale, '/api/image-proxy')}?url=${encodeURIComponent(trimmed)}`;
}

export function imageProxyUrls(locale: string, urls: string[]) {
  return urls.map((url) => imageProxyUrl(locale, url));
}

export async function fetchImageBlob(locale: string, url: string) {
  const response = await fetch(imageProxyUrl(locale, url));
  if (!response.ok) throw new Error(`Failed to download image (${response.status})`);
  return response.blob();
}