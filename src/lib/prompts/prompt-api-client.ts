import { requestJson, type JsonResponse } from '~/lib/api/json-client';
import { localeApiPath } from '~/lib/locale-api-path';
import type {
  PromptApiResponseDto,
  PromptSaveResponseDto,
  PromptTemplateResponseDto,
  PromptWriteRequestDto,
} from '~/lib/prompts/prompt-dto';

export function loadPromptTemplateForEdit(
  locale: string,
  id: number,
): Promise<JsonResponse<PromptApiResponseDto<PromptTemplateResponseDto>>> {
  return requestJson(localeApiPath(locale, `/api/my/templates/${id}`), {
    cache: 'no-store',
  });
}

export function savePromptTemplate(args: {
  locale: string;
  editId: number | null;
  isAuthenticated: boolean;
  payload: PromptWriteRequestDto;
}): Promise<JsonResponse<PromptApiResponseDto<PromptSaveResponseDto>>> {
  const endpoint =
    args.editId !== null
      ? `/api/my/templates/${args.editId}`
      : args.isAuthenticated
        ? '/api/my/templates'
        : '/api/prompts';

  return requestJson<
    PromptApiResponseDto<PromptSaveResponseDto>,
    PromptWriteRequestDto
  >(localeApiPath(args.locale, endpoint), {
    method: args.editId !== null ? 'PATCH' : 'POST',
    body: args.payload,
  });
}