import { requestJson, type JsonResponse } from '~/lib/api/json-client';
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