import { MAX_TITLE } from '~/lib/prompts/template-limits';
import { modelLabelToId, type TemplateRecord } from '~/lib/prompts/template-types';
import {
  normalizeSubmitCategoryKey,
  resolvePromptCategory,
  type SubmitCategoryKey,
} from '~/lib/prompts/prompt-categories';
import { MAX_RESULT_IMAGES, type SubmitFormPayload, type SubmitFormValues, type SubmitModelId } from './submit-types';

export function isValidImageSrc(value: string): boolean {
  const source = value.trim();
  return /^https?:\/\//i.test(source) || source.startsWith('data:');
}

export function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export function templateToSubmitFormValues(item: TemplateRecord): SubmitFormValues {
  const category = (resolvePromptCategory(item.category, item.tags) ?? '') as SubmitFormValues['category'];
  return {
    title: item.title,
    description: item.description,
    prompt: item.prompt,
    modelId: modelLabelToId(item.model) as SubmitModelId,
    category,
    tags: item.tags.filter((tag) => !normalizeSubmitCategoryKey(tag)),
    images: item.images.filter(isValidImageSrc).slice(0, MAX_RESULT_IMAGES),
    sourceUrl: item.sourceUrl ?? '',
    authorHandle: item.authorHandle ?? '',
    visibility: item.visibility,
    submissionId: String(item.id),
  };
}

export function buildSubmitPayload(input: {
  title: string;
  description: string;
  prompt: string;
  modelId: SubmitModelId;
  category: SubmitCategoryKey | '';
  tags: string[];
  images: string[];
  sourceUrl: string;
  authorHandle: string;
  visibility: SubmitFormPayload['visibility'];
}): SubmitFormPayload {
  return {
    title: input.title.trim().slice(0, MAX_TITLE),
    description: input.description.trim(),
    prompt: input.prompt.trim(),
    modelId: input.modelId,
    category: input.category,
    tags: input.tags,
    images: input.images.slice(0, MAX_RESULT_IMAGES),
    sourceUrl: input.sourceUrl.trim() || undefined,
    authorHandle: input.authorHandle.trim() || undefined,
    visibility: input.visibility,
  };
}

export function appendUniqueTag(tags: string[], raw: string, maxTags = 8) {
  const value = raw.replace(',', '').trim();
  if (!value || tags.includes(value) || tags.length >= maxTags) return tags;
  return [...tags, value];
}

export function appendImageUrl(images: string[], raw: string) {
  const value = raw.trim();
  if (!value || images.length >= MAX_RESULT_IMAGES || images.includes(value) || !isValidImageSrc(value)) {
    return images;
  }
  return [...images, value].slice(0, MAX_RESULT_IMAGES);
}