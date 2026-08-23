'use client';

import { useTranslations } from 'next-intl';
import type { SubmitCategoryKey } from '~/lib/prompts/prompt-categories';
import type { SubmitModelId } from './submit-types';
import { SubmitPreviewImageStrip } from './SubmitPreviewImageStrip';

export type SubmitLivePreviewProps = {
  title: string;
  description: string;
  prompt: string;
  modelId: SubmitModelId;
  category: SubmitCategoryKey | '';
  tags: string[];
  images: string[];
};

export function SubmitLivePreview({
  title,
  description,
  prompt,
  modelId,
  category,
  tags,
  images,
}: SubmitLivePreviewProps) {
  const t = useTranslations('OpenPrompts.submitPage');
  const tGallery = useTranslations('OpenPrompts.gallery');
  const modelLabel = t(`modelValues.${modelId}`);
  const categoryLabel = category ? t(`categories.${category}`) : '';

  const copyPrompt = () => {
    if (prompt) void navigator.clipboard.writeText(prompt);
  };

  return (
    <aside className="op-sp-preview-pane">
      <div className="op-sp-pane-h">
        <span className="text-xs font-medium tracking-wide text-[var(--text2)]">{t('preview.paneTitle')}</span>
        <span className="flex items-center gap-1 text-[10px] text-[var(--teal)]">
          <span className="inline-block h-1 w-1 rounded-full bg-[var(--teal)]" />
          {t('preview.live')}
        </span>
      </div>
      <div className="op-sp-pane-body">
        <div className="op-sp-card">
          <div className="op-sp-card-media">
            <SubmitPreviewImageStrip
              images={images}
              titleLabel={title.trim() || t('preview.titleEmpty')}
              coverLoadFailedText={tGallery('coverLoadFailed')}
              emptyLabel={t('preview.uploadPlaceholder')}
            />
          </div>
          <div className="p-3">
            <div className="mb-2 flex items-center gap-1 text-[10px] text-[var(--text3)]">
              <span>◎</span> {modelLabel}
            </div>
            <div
              className={`mb-1 text-sm font-medium ${title.trim() ? 'text-[var(--text)]' : 'italic text-[var(--text3)]'}`}
            >
              {title.trim() || t('preview.titleEmpty')}
            </div>
            <div className="mb-2 min-h-[2rem] text-[11px] text-[var(--text3)]">
              {description.trim() || t('preview.descEmpty')}
            </div>
            <div className="flex items-center justify-between">
              <span className="rounded border border-[var(--border)] bg-[var(--surface2)] px-2 py-0.5 text-[10px] text-[var(--text3)]">
                {categoryLabel || t('preview.categoryFallback')}
              </span>
              <span className="rounded-md bg-[var(--amber)] px-2 py-1 text-[11px] font-medium text-[#0e0d0b]">
                {t('preview.generateCta')}
              </span>
            </div>
          </div>
        </div>

        <div className="op-sp-code-block">
          <div className="mb-1 flex items-center justify-between text-[9px] uppercase tracking-wide text-[var(--text3)]">
            {t('labels.prompt')}
            <button
              type="button"
              className="rounded border border-[var(--border2)] px-1.5 py-0.5 text-[10px] text-[var(--text3)] hover:text-[var(--amber)]"
              onClick={copyPrompt}
              title={t('buttons.copyPrompt')}
            >
              {t('buttons.copyPrompt')}
            </button>
          </div>
          <p className={prompt.trim() ? '' : 'italic text-[var(--text3)]'}>
            {prompt.trim() || t('preview.promptEmpty')}
          </p>
        </div>

        <div className="mb-3 flex flex-wrap gap-1">
          {tags.map((tag) => (
            <span
              key={tag}
              className="rounded border border-[color-mix(in_oklab,var(--amber)_20%,transparent)] bg-[var(--amber-dim)] px-2 py-0.5 text-[10px] text-[var(--amber)]"
            >
              {tag}
            </span>
          ))}
        </div>
      </div>
    </aside>
  );
}