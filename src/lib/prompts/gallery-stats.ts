import type { PromptGalleryItem } from '~/lib/prompts/prompt-model';

export function formatGalleryStatCount(n: number, locale: string): string {
  const tag = locale === 'zh' ? 'zh-CN' : locale === 'ja' ? 'ja-JP' : 'en-US';
  return new Intl.NumberFormat(tag).format(n);
}

export function countGalleryModels(prompts: Pick<PromptGalleryItem, 'model'>[]): number {
  return new Set(prompts.map((p) => p.model).filter(Boolean)).size;
}
