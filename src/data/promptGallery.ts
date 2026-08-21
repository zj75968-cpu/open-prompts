import type { PromptGalleryItem } from '~/lib/prompts/prompt-model';
import { promptAssetToGalleryItem } from '~/lib/prompts/prompt-asset';
import { GPT_IMAGE_2_PROMPT_ASSETS } from './imports/gpt-image2-prompts';

export type { PromptGalleryItem } from '~/lib/prompts/prompt-model';

export const PROMPT_GALLERY: PromptGalleryItem[] = GPT_IMAGE_2_PROMPT_ASSETS.map(promptAssetToGalleryItem).reverse();