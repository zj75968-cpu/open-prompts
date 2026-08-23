'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { imageProxyUrl } from './create-api';
import { GenerationImageCard } from './GenerationImageCard';
import type { GenerationHistoryEntry } from './types';

type Props = {
  locale: string;
  history: GenerationHistoryEntry[];
  onSelect(entry: GenerationHistoryEntry): void;
  onDelete(id: string): void;
  onOpenViewer(images: string[], index: number, prefix: string): void;
};

export function HistoryPanel({
  locale,
  history,
  onSelect,
  onDelete,
  onOpenViewer,
}: Props) {
  const t = useTranslations('OpenPrompts');
  const [ratioByUrl, setRatioByUrl] = useState<Record<string, string>>({});

  return (
    <div className="mt-4">
      <div className="mb-2 text-[10px] font-medium tracking-[0.08em] text-[var(--text3)]">
        {t('createPage.historyLabel')}
      </div>
      {history.length ? (
        <div className="flex flex-col gap-3">
          {history.map((entry) => (
            <div
              key={entry.id}
              className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"
            >
              <div className="flex items-start justify-between gap-3">
                <button
                  type="button"
                  className="min-w-0 flex-1 text-left"
                  onClick={() => onSelect(entry)}
                  title={new Date(entry.createdAt).toLocaleString()}
                >
                  <div className="mt-1 line-clamp-2 text-[11px] leading-snug text-[var(--text2)]">
                    {entry.prompt}
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-[var(--text3)]">
                    {[
                      entry.provider,
                      entry.model,
                      entry.aspectRatio,
                      entry.quality,
                      `×${entry.count}`,
                    ].map((value, index) => (
                      <span
                        key={`${value}_${index}`}
                        className="rounded-full border border-[var(--border)] bg-[var(--surface2)] px-2 py-0.5"
                      >
                        {value}
                      </span>
                    ))}
                  </div>
                </button>
                <button
                  type="button"
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[var(--border)] bg-[var(--surface2)] text-[var(--text3)] hover:border-[var(--border2)] hover:text-red-400"
                  title={t('createPage.deleteTitle')}
                  onClick={() => onDelete(entry.id)}
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path
                      d="M4 7h16M10 11v6m4-6v6M9 7l1-2h4l1 2m-9 0l1 14h10l1-14"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>

              {entry.images.length ? (
                <div className="mt-3 flex flex-col gap-2">
                  {entry.images.map((url, index) => {
                    const displayUrl = imageProxyUrl(locale, url);
                    return (
                      <GenerationImageCard
                        key={`${url}_${index}`}
                        locale={locale}
                        sourceUrl={url}
                        displayUrl={displayUrl}
                        aspectRatio={ratioByUrl[displayUrl] ?? '4 / 3'}
                        positionLabel={`${index + 1}/${entry.images.length}`}
                        onOpen={() =>
                          onOpenViewer(entry.images, index, `hist-${entry.id}`)
                        }
                        onAspectRatio={(aspectRatio) =>
                          setRatioByUrl((previous) =>
                            previous[displayUrl] === aspectRatio
                              ? previous
                              : { ...previous, [displayUrl]: aspectRatio },
                          )
                        }
                      />
                    );
                  })}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[var(--border2)] bg-[var(--surface2)] p-4 text-center">
          <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-lg text-[var(--text3)]">
            ✦
          </div>
          <p className="text-[11px] leading-relaxed text-[var(--text3)]">
            {t('createPage.railHistoryEmpty')}
          </p>
          <button
            type="button"
            className="mt-3 text-[11px] font-medium text-[var(--amber)] hover:underline"
            onClick={() =>
              document.getElementById('op-create-prompt')?.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
              })
            }
          >
            {t('createPage.railCurrentJump')}
          </button>
        </div>
      )}
    </div>
  );
}