import type {
  GenerationCreateParams,
  GenerationStatus,
} from '~/lib/generation/types';

export type GenerationCreateRequestDto = GenerationCreateParams & {
  provider?: string;
  apiKey?: string;
};

export type GenerationCreateResponseDto = {
  provider: string;
  providerJobId: string;
  status: GenerationStatus;
  images?: string[];
};

export type GenerationPollResponseDto = {
  provider: string;
  providerJobId: string;
  status: GenerationStatus;
  images?: string[];
  error?: string;
};

export type GenerationErrorResponseDto = {
  error: string;
  detail?: string;
  hint?: string;
  limits?: {
    daily: number | null;
    monthly: number | null;
  };
  usage?: Record<string, unknown>;
};

export type GenerationApiResponseDto<T> = T | GenerationErrorResponseDto;

export function isGenerationErrorResponse(
  value: GenerationApiResponseDto<unknown>,
): value is GenerationErrorResponseDto {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    !('status' in value)
  );
}
