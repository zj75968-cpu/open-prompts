import { requestJson, type JsonResponse } from '~/lib/api/json-client';
import { getOrCreateUserId } from '~/lib/credits/fingerprint';
import type {
  GenerationApiResponseDto,
  GenerationCreateRequestDto,
  GenerationCreateResponseDto,
  GenerationPollResponseDto,
} from '~/lib/generation/generation-dto';
import { localeApiPath } from '~/lib/locale-api-path';

export function createGenerationJob(
  locale: string,
  request: GenerationCreateRequestDto,
): Promise<JsonResponse<GenerationApiResponseDto<GenerationCreateResponseDto>>> {
  return requestJson<
    GenerationApiResponseDto<GenerationCreateResponseDto>,
    GenerationCreateRequestDto
  >(localeApiPath(locale, '/api/generations'), {
    method: 'POST',
    headers: { 'x-op-user-id': getOrCreateUserId() },
    body: request,
  });
}

export function pollGenerationJob(
  locale: string,
  providerJobId: string,
  apiKey?: string,
): Promise<JsonResponse<GenerationApiResponseDto<GenerationPollResponseDto>>> {
  return requestJson<GenerationApiResponseDto<GenerationPollResponseDto>>(
    localeApiPath(
      locale,
      `/api/generations/${encodeURIComponent(providerJobId)}`,
    ),
    {
      cache: 'no-store',
      headers: apiKey ? { 'x-op-api-key': apiKey } : undefined,
    },
  );
}