'use client';

import { useTranslations } from 'next-intl';
import type { XSourceDuplicate } from '~/lib/x-import/x-source-duplicate';

export type SourceImportProps = {
  url: string;
  authorHandle: string;
  busy: boolean;
  error: string | null;
  succeeded: boolean;
  duplicate: XSourceDuplicate | null;
  onImportUrlChange: (value: string) => void;
  onSourceUrlChange: (value: string) => void;
  onAuthorHandleChange: (value: string) => void;
  onImport: () => void | Promise<void>;
};

export function SourceImport({
  url,
  authorHandle,
  busy,
  error,
  succeeded,
  duplicate,
  onImportUrlChange,
  onSourceUrlChange,
  onAuthorHandleChange,
  onImport,
}: SourceImportProps) {
  const t = useTranslations('OpenPrompts.submitPage');

  const duplicateStatusLabel = (status: string) => {
    const known = ['approved', 'pending', 'rejected', 'draft'] as const;
    if ((known as readonly string[]).includes(status)) {
      return t(`xImport.duplicateStatus.${status}` as 'xImport.duplicateStatus.approved');
    }
    return status;
  };

  return (
    <section aria-labelledby="source-import-title">
      <div className="op-sp-form-group mb-6 rounded-lg border border-[var(--border2)] bg-[var(--surface)] p-4">
        <div id="source-import-title" className="op-sp-label mb-2 !normal-case !tracking-normal">
          {t('xImport.title')}
        </div>
        <p className="mb-3 text-xs leading-relaxed text-[var(--text2)]">{t('xImport.desc')}</p>
        <div className="op-sp-source-row">
          <input
            className="op-sp-input"
            type="url"
            inputMode="url"
            value={url}
            onChange={(event) => onImportUrlChange(event.target.value)}
            placeholder={t('xImport.placeholder')}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              void onImport();
            }}
          />
          <button
            type="button"
            className="op-sp-btn-next shrink-0 whitespace-nowrap py-2"
            disabled={busy}
            onClick={() => void onImport()}
          >
            {busy ? t('xImport.busy') : t('xImport.button')}
          </button>
        </div>
        {error ? <p className="mt-2 text-xs text-[var(--coral)]">{error}</p> : null}
        {duplicate ? (
          <div className="op-sp-info mt-2 border-[var(--amber)]/30 bg-[color-mix(in_oklab,var(--amber)_8%,transparent)]">
            <p className="text-xs leading-relaxed text-[var(--text2)]">
              {t('xImport.duplicateHint', {
                title: duplicate.title,
                status: duplicateStatusLabel(duplicate.status),
              })}{' '}
              {duplicate.sourceUrl ? (
                <a href={duplicate.sourceUrl} target="_blank" rel="noopener noreferrer">
                  {t('xImport.duplicateLink')}
                </a>
              ) : null}
            </p>
          </div>
        ) : null}
        {succeeded ? <p className="mt-2 text-xs text-[var(--teal)]">{t('xImport.success')}</p> : null}
      </div>

      <div className="op-sp-form-group op-sp-two">
        <div>
          <label className="op-sp-label" htmlFor="f-source">
            {t('labels.sourceUrl')}
          </label>
          <input
            id="f-source"
            className="op-sp-input"
            type="url"
            inputMode="url"
            value={url}
            onChange={(event) => onSourceUrlChange(event.target.value)}
            placeholder={t('placeholders.source')}
          />
          <p className="op-sp-label op-hint">{t('hints.source')}</p>
        </div>
        <div>
          <label className="op-sp-label" htmlFor="f-author">
            {t('labels.author')}
          </label>
          <input
            id="f-author"
            className="op-sp-input"
            value={authorHandle}
            onChange={(event) => onAuthorHandleChange(event.target.value)}
            placeholder={t('placeholders.author')}
          />
          <p className="op-sp-label op-hint">{t('hints.author')}</p>
        </div>
      </div>
    </section>
  );
}