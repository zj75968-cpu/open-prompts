import type { PromptGalleryItem } from '~/lib/prompts/prompt-model';
import type { SubmitCategoryKey } from '~/lib/prompts/prompt-categories';

export function filterPromptsByModel(prompts: PromptGalleryItem[], model: string): PromptGalleryItem[] {
  return prompts.filter((p) => p.model === model);
}

export function filterPromptsByCategory(
  prompts: PromptGalleryItem[],
  category: SubmitCategoryKey,
): PromptGalleryItem[] {
  return prompts.filter((p) => p.category === category);
}
