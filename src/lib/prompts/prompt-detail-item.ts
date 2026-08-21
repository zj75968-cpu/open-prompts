import type {
  PromptDetailItem,
  PromptGalleryItem,
} from '~/lib/prompts/prompt-model';
import type { TemplateRecord } from '~/lib/prompts/template-types';

export type { PromptDetailItem } from '~/lib/prompts/prompt-model';

export function promptGalleryItemToDetailItem(
  item: PromptGalleryItem,
): PromptDetailItem {
  return {
    id: item.id,
    title: item.title,
    description: item.description ?? '',
    prompt: item.prompt ?? '',
    model: item.model,
    tags: item.tags ?? [],
    images: item.images ?? [],
    sourceUrl: item.sourceUrl ?? null,
    authorHandle: item.authorHandle ?? null,
  };
}

export function templateRecordToDetailItem(
  row: TemplateRecord,
): PromptDetailItem {
  return {
    id: row.slug,
    title: row.title,
    description: row.description ?? '',
    prompt: row.prompt ?? '',
    model: row.model,
    tags: row.tags ?? [],
    images: row.images ?? [],
    sourceUrl: row.sourceUrl ?? null,
    authorHandle: row.authorHandle ?? null,
  };
}
