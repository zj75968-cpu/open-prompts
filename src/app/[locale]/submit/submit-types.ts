import type { TemplateRecord } from '~/lib/prompts/template-types';
import {
  PROMPT_MODEL_IDS,
  type PromptWriteRequestDto,
} from '~/lib/prompts/prompt-dto';
import type { XSourceDuplicate } from '~/lib/x-import/x-source-duplicate';

export { MAX_TITLE } from '~/lib/prompts/template-limits';

export const MAX_RESULT_IMAGES = 8;

export const MODEL_IDS = PROMPT_MODEL_IDS;

export type SubmitModelId = (typeof MODEL_IDS)[number];

export const MODEL_EMOJI: Record<SubmitModelId, string> = {
  gptImage2: '🤖',
  midjourney: '🎨',
  dalle3: '✦',
  flux: '⚡',
  sd: '🌊',
  ideogram: '💎',
};

export type SubmitFormPayload = PromptWriteRequestDto;

export type SubmitFormValues = Omit<SubmitFormPayload, 'sourceUrl' | 'authorHandle'> & {
  sourceUrl: string;
  authorHandle: string;
  submissionId: string;
};

export type LoadTemplateResponse = {
  item?: TemplateRecord;
  error?: string;
};

export type XImportFormValues = {
  title?: string;
  description?: string;
  prompt?: string;
  images?: string[];
  sourceUrl?: string;
  authorHandle?: string;
};

export type XImportResponse = {
  ok?: boolean;
  error?: string;
  duplicate?: XSourceDuplicate;
  title?: string;
  description?: string;
  prompt?: string;
  imageUrls?: string[];
  sourceUrl?: string;
  authorHandle?: string;
};

export type SubmitTemplateResponse = {
  ok?: boolean;
  id?: number;
  item?: TemplateRecord;
  error?: string;
  duplicate?: XSourceDuplicate;
};