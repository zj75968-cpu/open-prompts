'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { LuMaximize2 } from 'react-icons/lu';
import { CoverImage } from '~/components/prompt-gallery/CoverImage';
import type { PromptGalleryItem } from '~/lib/prompts/prompt-model';

type ViewerOptions = {
  title?: string;
  prefix?: string;
  showDownload?: boolean;
};

type Props = {
  query: string;
  selectedId: string;
  selectedItem?: PromptGalleryItem;
  templates: PromptGalleryItem[];
  onQueryChange(query: string): void;
  onSelect(id: string): void;
  onOpenViewer(images: string[], index: number, options?: ViewerOptions): void;
};

export function TemplatePanel({
  query,
  selectedId,
  selectedItem,
  templates,
  onQueryChange,
  onSelect,
  onOpenViewer,
}: Props) {
  const t = useTranslations('OpenPrompts');
  const [ratioById, setRatioById] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);

  const copyOriginalPrompt = async () => {
    try {
      await navigator.clipboard.writeText(selectedItem?.prompt ?? '');
      setCopied(true);
    } finally {
      window.setTimeout(() => setCopied(false), 900);
    }
  };

  return (
    <aside className="relative z-30 hidden min-h-0 flex-col border-r border-[var(--border2)] bg-[color-mix(in_oklab,var(--bg)_70%,var(--surface))] shadow-[inset_-1px_0_0_rgba(255,255,255,0.04)] md:flex">
      <div className="border-b border-[var(--border)] px-4 py-3">
        <div className="text-[11px] font-medium tracking-[0.08em] text-[var(--text2)]">
          {t('createPage.templatesLabel')}
        </div>
      </div>
      <div className="border-b border-[var(--border)] p-3">
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder={t('createPage.searchTemplatesPlaceholder')}
          className="w-full rounded-lg border border-[var(--border2)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text3)] focus:border-[var(--amber)]"
        />
      </div>
      <div className="flex-1 overflow-y-auto p-3">
        <div className="flex flex-col gap-2">
          {templates.map((template) => {
            const selected = template.id === selectedId;
            const source = template.images[0];
            return (
              <div
                key={template.id}
                role="button"
                tabIndex={0}
                title={template.title}
                onClick={() => onSelect(template.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onSelect(template.id);
                  }
                }}
                className={`group relative w-full cursor-pointer overflow-hidden rounded-lg border outline-none transition focus-visible:ring-2 focus-visible:ring-[var(--amber)] ${
                  selected
                    ? 'border-[var(--amber)] shadow-[0_0_0_2px_color-mix(in_oklab,var(--amber)_30%,transparent)]'
                    : 'border-[var(--border)] hover:border-[var(--border2)]'
                }`}
              >
                <div
                  className="w-full bg-[var(--surface2)]"
                  style={{ aspectRatio: ratioById[template.id] ?? '4 / 3' }}
                >
                  {source ? (
                    <CoverImage
                      src={source}
                      alt={template.title}
                      sizes="280px"
                      className="object-contain"
                      errorText={t('gallery.coverLoadFailed')}
                      onMeta={({ width, height }) => {
                        const aspectRatio = `${width} / ${height}`;
                        setRatioById((previous) =>
                          previous[template.id] === aspectRatio
                            ? previous
                            : { ...previous, [template.id]: aspectRatio },
                        );
                      }}
                    />
                  ) : (
                    <div className="grid h-full w-full place-items-center text-xs text-[var(--text3)]">
                      —
                    </div>
                  )}
                </div>
                <div className="pointer-events-none absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />
                {source ? (
                  <button
                    type="button"
                    className="absolute right-2 top-2 z-10 grid h-7 w-7 place-items-center rounded-md bg-black/55 text-white/90 opacity-90 shadow-sm transition hover:bg-black/70 md:opacity-0 md:group-hover:opacity-100"
                    title={t('createPage.fullscreenTitle')}
                    aria-label={t('createPage.fullscreenTitle')}
                    onClick={(event) => {
                      event.stopPropagation();
                      onOpenViewer(template.images, 0, {
                        title: template.title,
                        prefix: template.id,
                        showDownload: false,
                      });
                    }}
                  >
                    <LuMaximize2 className="h-4 w-4" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            );
          })}
        </div>
      </div>

      <div className="border-t border-[var(--border)] p-3">
        <div className="mb-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-medium tracking-[0.08em] text-[var(--text2)]">
              {t('createPage.originalPromptLabel')}
            </div>
            <button
              type="button"
              className="text-[11px] text-[var(--text3)] hover:text-[var(--amber)]"
              onClick={copyOriginalPrompt}
            >
              {copied ? t('modal.copied') : t('modal.copy')}
            </button>
          </div>
          <div className="mt-2 max-h-28 overflow-y-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-[var(--text2)]">
            {selectedItem?.prompt ?? ''}
          </div>
        </div>
      </div>
    </aside>
  );
}