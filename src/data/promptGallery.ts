import type { SubmitCategoryKey } from '~/lib/prompts/prompt-categories';
import { promptAssetToGalleryItem } from '~/lib/prompts/prompt-asset';
import { GPT_IMAGE_2_PROMPT_ASSETS } from './imports/gpt-image2-prompts';

export type PromptGalleryItem = {
  id: string;
  title: string;
  description: string;
  prompt: string;
  templateId?: string;
  model: string;
  category?: SubmitCategoryKey | null;
  tags: string[];
  sourceUrl?: string;
  authorHandle?: string;
  /** ISO 8601 — shown on card footer as MM-DD after the source label. */
  createdAt?: string;
  images: string[];
};

export const PROMPT_GALLERY: PromptGalleryItem[] = GPT_IMAGE_2_PROMPT_ASSETS.map(promptAssetToGalleryItem).reverse();