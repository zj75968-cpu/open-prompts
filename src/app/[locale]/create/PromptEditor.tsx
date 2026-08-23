'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';

type Props = {
  prompt: string;
  onPromptChange(prompt: string): void;
};

export function PromptEditor({ prompt, onPromptChange }: Props) {
  const t = useTranslations('OpenPrompts');
  const [copied, setCopied] = useState(false);

  const copyPrompt = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
    } finally {
      window.setTimeout(() => setCopied(false), 900);
    }
  };

  const enhancePrompt = () => {
    onPromptChange(
      prompt.trim() + (prompt.includes('highly detailed') ? '' : ', highly detailed'),
    );
  };

  return (
    <div className="border-b border-[var(--border)] p-4">
      <div className="mb-2 flex items-center justify-between">
        <div className="text-[11px] font-medium tracking-[0.08em] text-[var(--text2)]">
          {t('createPage.promptSectionLabel')}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg border border-[var(--border2)] bg-[var(--surface)] px-3 py-1.5 text-[11px] text-[var(--text2)] hover:text-[var(--text)]"
            onClick={copyPrompt}
          >
            {copied ? t('modal.copied') : t('modal.copy')}
          </button>
          <button
            type="button"
            className="rounded-lg border border-[color-mix(in_oklab,var(--amber)_35%,transparent)] bg-[color-mix(in_oklab,var(--amber)_12%,transparent)] px-3 py-1.5 text-[11px] text-[var(--amber2)]"
            onClick={enhancePrompt}
          >
            {t('createPage.enhanceButton')}
          </button>
        </div>
      </div>

      <textarea
        id="op-create-prompt"
        className="h-48 w-full resize-none rounded-xl border border-[var(--border2)] bg-[var(--surface)] p-4 text-[12.5px] leading-relaxed text-[var(--text)] outline-none placeholder:text-[var(--text3)] focus:border-[var(--amber)]"
        value={prompt}
        onChange={(event) => onPromptChange(event.target.value)}
        placeholder={t('createPage.promptPlaceholder')}
      />

      <div className="mt-2 flex items-center justify-between text-[10px] text-[var(--text3)]">
        <span>{prompt.length} / 2000</span>
      </div>
    </div>
  );
}