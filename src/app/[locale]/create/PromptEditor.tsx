'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import type { PromptLensDraft } from './use-promptlens-draft';

type Props = {
  prompt: string;
  negativePrompt: string;
  source?: Pick<PromptLensDraft, 'sourceImageUrl' | 'sourcePageUrl'> | null;
  onPromptChange(prompt: string): void;
  onNegativePromptChange(prompt: string): void;
  onSourceImageUrlChange(sourceImageUrl: string): void;
};

export function PromptEditor({
  prompt,
  negativePrompt,
  source,
  onPromptChange,
  onNegativePromptChange,
  onSourceImageUrlChange,
}: Props) {
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
        maxLength={12000}
        onChange={(event) => onPromptChange(event.target.value)}
        placeholder={t('createPage.promptPlaceholder')}
      />

      <div className="mt-2 flex items-center justify-between text-[10px] text-[var(--text3)]">
        <span>{prompt.length} / 12000</span>
      </div>

      <div className="mt-4">
        <label
          htmlFor="op-create-negative-prompt"
          className="mb-2 block text-[11px] font-medium tracking-[0.08em] text-[var(--text2)]"
        >
          {t('createPage.negativePromptLabel')}
        </label>
        <textarea
          id="op-create-negative-prompt"
          className="h-24 w-full resize-none rounded-xl border border-[var(--border2)] bg-[var(--surface)] p-4 text-[12.5px] leading-relaxed text-[var(--text)] outline-none placeholder:text-[var(--text3)] focus:border-[var(--amber)]"
          value={negativePrompt}
          maxLength={6000}
          onChange={(event) => onNegativePromptChange(event.target.value)}
          placeholder={t('createPage.negativePromptPlaceholder')}
        />
        <div className="mt-2 text-right text-[10px] text-[var(--text3)]">
          {negativePrompt.length} / 6000
        </div>
      </div>

      {source?.sourceImageUrl || source?.sourcePageUrl ? (
        <div className="mt-4 rounded-xl border border-[color-mix(in_oklab,var(--amber)_28%,var(--border))] bg-[color-mix(in_oklab,var(--amber)_8%,var(--surface))] p-3 text-[11px] text-[var(--text2)]">
          <div className="font-medium text-[var(--amber2)]">
            {t('createPage.promptLensImported')}
          </div>
          <label
            htmlFor="op-create-source-image"
            className="mt-3 block font-medium tracking-[0.04em] text-[var(--text2)]"
          >
            {t('createPage.sourceImageLabel')}
          </label>
          <input
            id="op-create-source-image"
            type="url"
            value={source.sourceImageUrl}
            maxLength={4000}
            onChange={(event) => onSourceImageUrlChange(event.target.value)}
            placeholder={t('createPage.sourceImagePlaceholder')}
            className="mt-2 h-10 w-full rounded-lg border border-[var(--border2)] bg-[var(--surface)] px-3 text-[11px] text-[var(--text)] outline-none placeholder:text-[var(--text3)] focus:border-[var(--amber)]"
          />
          <div className="mt-1 text-[10px] text-[var(--text3)]">
            {t('createPage.sourceImageHint')}
          </div>
          <div className="mt-2 flex flex-wrap gap-x-4 gap-y-2">
            {source.sourceImageUrl ? (
              <a
                href={source.sourceImageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[var(--amber)] hover:underline"
              >
                {t('createPage.promptLensSourceImage')}
              </a>
            ) : null}
            {source.sourcePageUrl ? (
              <a
                href={source.sourcePageUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-[var(--amber)] hover:underline"
              >
                {t('createPage.promptLensSourcePage')}
              </a>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
