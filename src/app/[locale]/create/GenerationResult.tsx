'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { imageProxyUrl } from './create-api';
import { GenerationImageCard } from './GenerationImageCard';
import type { GenerationUiState } from './types';

type Props = {
  locale: string;
  uiState: GenerationUiState;
  providerJobId: string | null;
  images: string[];
  count: number;
  onOpenViewer(images: string[], index: number): void;
};

function EmptyResult({ body, action }: { body: string; action: string }) {
  const jumpToPrompt = () => {
    document.getElementById('op-create-prompt')?.scrollIntoView({
      behavior: 'smooth',
      block: 'center',
    });
  };

  return (
    <div className="rounded-xl border border-dashed border-[var(--border2)] bg-[var(--surface2)] p-4 text-center">
      <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-lg text-[var(--text3)]">
        ✦
      </div>
      <p className="text-[11px] leading-relaxed text-[var(--text3)]">{body}</p>
      <button
        type="button"
        className="mt-3 text-[11px] font-medium text-[var(--amber)] hover:underline"
        onClick={jumpToPrompt}
      >
        {action}
      </button>
    </div>
  );
}

export function GenerationResult({
  locale,
  uiState,
  providerJobId,
  images,
  count,
  onOpenViewer,
}: Props) {
  const t = useTranslations('OpenPrompts');
  const [ratioByUrl, setRatioByUrl] = useState<Record<string, string>>({});
  const generating = uiState === 'queued' || uiState === 'running';

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
      <div className="flex items-center justify-between gap-2 text-[10px] tracking-[0.08em] text-[var(--text3)]">
        <span>{t('createPage.currentLabel')}</span>
        {providerJobId ? (
          <span
            className="max-w-[min(160px,45%)] truncate font-mono text-[10px] text-[var(--text3)]"
            title={providerJobId}
          >
            {providerJobId}
          </span>
        ) : (
          <span className="text-[10px] font-normal normal-case tracking-normal text-[var(--text3)]">
            {t('createPage.railJobIdle')}
          </span>
        )}
      </div>

      <div className="mt-2">
        {generating ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: Math.max(1, count) }).map((_, index) => (
              <div
                key={index}
                className="h-32 w-full animate-pulse rounded-lg bg-[var(--surface2)]"
              />
            ))}
          </div>
        ) : images.length ? (
          <div className="flex flex-col gap-2">
            {images.map((url, index) => {
              const displayUrl = imageProxyUrl(locale, url);
              return (
                <GenerationImageCard
                  key={`${url}_${index}`}
                  locale={locale}
                  sourceUrl={url}
                  displayUrl={displayUrl}
                  aspectRatio={ratioByUrl[displayUrl] ?? '4 / 3'}
                  positionLabel={`${index + 1}/${images.length}`}
                  onOpen={() => onOpenViewer(images, index)}
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
        ) : (
          <EmptyResult
            body={
              uiState === 'failed'
                ? t('gen.tryAgain')
                : t('createPage.railCurrentEmpty')
            }
            action={t('createPage.railCurrentJump')}
          />
        )}
      </div>
    </div>
  );
}