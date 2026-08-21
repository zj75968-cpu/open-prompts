import type { SubmitCategoryKey } from '~/lib/prompts/prompt-categories';

/** Shared prompt content independent of storage, transport, or presentation layers. */
export type PromptContent = {
  title: string;
  description: string;
  prompt: string;
  model: string;
  category: SubmitCategoryKey | null;
  tags: string[];
  images: string[];
};

/** Public prompt shape consumed by gallery, SEO, and generation entry points. */
export type PromptGalleryItem = Omit<PromptContent, 'category'> & {
  id: string;
  templateId?: string;
  category?: SubmitCategoryKey | null;
  sourceUrl?: string;
  authorHandle?: string;
  /** ISO 8601 — shown on card footer as MM-DD after the source label. */
  createdAt?: string;
};

/** Presentation model shared by gallery and account detail views. */
export type PromptDetailItem = Pick<
  PromptContent,
  'title' | 'description' | 'prompt' | 'model' | 'tags' | 'images'
> & {
  /** Slug or gallery id used for `?template=` on the create page. */
  id: string;
  sourceUrl?: string | null;
  authorHandle?: string | null;
};