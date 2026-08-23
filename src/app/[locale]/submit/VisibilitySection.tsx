'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

export type VisibilitySectionProps = {
  isEditMode: boolean;
  isPrivateMode: boolean;
  submitting: boolean;
  blockedHint: string | null;
  prompt: string;
  checks: {
    promptLength: boolean;
    title: boolean;
    model: boolean;
    category: boolean;
    tags: boolean;
  };
  onSubmit: () => void | Promise<void>;
};

export function VisibilitySection({
  isEditMode,
  isPrivateMode,
  submitting,
  blockedHint,
  prompt,
  checks,
  onSubmit,
}: VisibilitySectionProps) {
  const t = useTranslations('OpenPrompts.submitPage');
  const [copied, setCopied] = useState(false);

  const copyPrompt = () => {
    if (!prompt) return;
    void navigator.clipboard.writeText(prompt).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    });
  };

  return (
    <section aria-label={isPrivateMode ? t('privateMode.eyebrow') : t('wizard.eyebrow')}>
      {isPrivateMode ? (
        <div className="op-sp-info mb-6 border-[var(--amber)]/30 bg-[color-mix(in_oklab,var(--amber)_8%,transparent)]">
          <p>{t('privateMode.hint')}</p>
        </div>
      ) : null}

      <div className="op-sp-info mb-6">
        <p>
          {t('info.body', { ar: t('info.ar'), v: t('info.v') })}{' '}
          <a href="#">{t('info.link')}</a>
        </p>
      </div>

      <div className="op-sp-form-group rounded-lg border border-[var(--border2)] bg-[var(--surface2)] p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="text-[11px] font-medium text-[var(--text2)]">{t('qualityCheck')}</span>
          <button
            type="button"
            className="shrink-0 rounded border border-[var(--border2)] px-2 py-0.5 text-[10px] text-[var(--text3)] hover:text-[var(--amber)]"
            onClick={copyPrompt}
          >
            {copied ? t('buttons.copied') : t('buttons.copyPrompt')}
          </button>
        </div>
        {(
          [
            ['rules.promptLen', checks.promptLength],
            ['rules.title', checks.title],
            ['rules.model', checks.model],
            ['rules.category', checks.category],
            ['rules.tags', checks.tags],
          ] as const
        ).map(([key, ok]) => (
          <div
            key={key}
            className="flex gap-2 border-b border-[var(--border)] py-1.5 text-[11px] text-[var(--text2)] last:border-0"
          >
            <span className={`op-sp-rule-icon ${ok ? 'ok' : 'no'}`}>{ok ? '✓' : '✕'}</span>
            <span>{t(key)}</span>
          </div>
        ))}
      </div>

      {blockedHint ? (
        <div
          role="alert"
          className="mb-3 rounded-lg border border-[color-mix(in_oklab,var(--coral)_35%,transparent)] bg-[var(--coral-dim)] px-3 py-2 text-xs leading-snug text-[var(--coral)]"
        >
          {blockedHint}
        </div>
      ) : null}

      <div className="op-sp-form-nav mt-8 justify-end border-0 pt-2">
        <button
          type="button"
          className="op-sp-btn-next op-submit"
          disabled={submitting}
          aria-busy={submitting}
          onClick={() => void onSubmit()}
        >
          {submitting
            ? t('buttons.submitting')
            : isEditMode
              ? t('editMode.save')
              : isPrivateMode
                ? t('privateMode.submit')
                : t('buttons.submit')}
        </button>
      </div>
    </section>
  );
}