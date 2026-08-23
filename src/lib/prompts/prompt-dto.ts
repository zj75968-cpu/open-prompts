import type { PromptGalleryItem } from '~/lib/prompts/prompt-model';
import type { SubmitCategoryKey } from '~/lib/prompts/prompt-categories';
import type {
  PromptVisibility,
  TemplateRecord,
} from '~/lib/prompts/template-types';
import type { XSourceDuplicate } from '~/lib/x-import/x-source-duplicate';

export const PROMPT_MODEL_IDS = [
  'gptImage2',
  'midjourney',
  'dalle3',
  'flux',
  'sd',
  'ideogram',
] as const;

export type PromptModelIdDto = (typeof PROMPT_MODEL_IDS)[number];

export type PromptWriteRequestDto = {
  title: string;
  description: string;
  prompt: string;
  modelId: PromptModelIdDto;
  category: SubmitCategoryKey | '';
  tags: string[];
  images: string[];
  sourceUrl?: string;
  authorHandle?: string;
  visibility: PromptVisibility;
};

export type PromptGalleryResponseDto = {
  prompts: PromptGalleryItem[];
  source: 'ok';
};

export type PromptCreateResponseDto = {
  ok: true;
  id: number;
  slug: string;
};

export type PromptTemplateResponseDto = {
  item: TemplateRecord;
};

export type PromptTemplateMutationResponseDto = PromptTemplateResponseDto & {
  ok: true;
};

export type PromptSaveResponseDto =
  | PromptCreateResponseDto
  | PromptTemplateMutationResponseDto;

export type PromptDeleteResponseDto = {
  ok: true;
};

export type PromptApiErrorResponseDto = {
  error: string;
  duplicate?: XSourceDuplicate;
};

export type PromptApiResponseDto<T> = T | PromptApiErrorResponseDto;

export function isPromptApiErrorResponse(
  value: PromptApiResponseDto<unknown>,
): value is PromptApiErrorResponseDto {
  return typeof value === 'object' && value !== null && 'error' in value;
}