'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { accountPanelHref } from '~/lib/account/account-path';
import type { SubmitCategoryKey } from '~/lib/prompts/prompt-categories';
import type { SubmitModelId } from './submit-types';

export type SubmitSuccessProps = {
  locale: string;
  isEditMode: boolean;
  isPrivateMode: boolean;
  authStatus: 'authenticated' | 'loading' | 'unauthenticated';
  modelId: SubmitModelId;
  category: SubmitCategoryKey | '';
  submissionId: string;
  onReset: () => void;
};

export function SubmitSuccess({
  locale,
  isEditMode,
  isPrivateMode,
  authStatus,
  modelId,
  category,
  submissionId,
  onReset,
}: SubmitSuccessProps) {
  const t = useTranslations('OpenPrompts.submitPage');
  const accountHref = accountPanelHref(locale, 'prompts');
  const galleryHref = locale === 'en' ? '/' : `/${locale}`;
  const modelLabel = t(`modelValues.${modelId}`);
  const categoryLabel = category ? t(`categories.${category}`) : '';

  return (
    <div className="op-sp-success op-show">
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full border border-[rgba(45,212,160,0.3)] bg-[var(--teal-dim)] text-2xl">
        🎉
      </div>
      <h2 className="mb-2 text-2xl font-semibold">
        {isEditMode
          ? t('editMode.successTitle')
          : isPrivateMode
            ? t('privateMode.successTitle')
            : t('success.title')}
        <em className="italic text-[var(--teal)]">
          {isEditMode
            ? t('editMode.successTitleEm')
            : isPrivateMode
              ? t('privateMode.successTitleEm')
              : t('success.titleEm')}
        </em>
      </h2>
      <p className="mx-auto mb-6 max-w-[340px] text-sm font-light leading-relaxed text-[var(--text2)]">
        {isEditMode
          ? t('editMode.successBody')
          : isPrivateMode
            ? t('privateMode.successBody')
            : authStatus === 'authenticated'
              ? t('success.body')
              : t('success.bodySignedOut')}
      </p>
      <p className="mb-4 text-center text-[11px] text-[var(--text3)]">
        {modelLabel}
        {categoryLabel ? ` · ${categoryLabel}` : null}
      </p>
      <div className="flex flex-wrap justify-center gap-2">
        {isEditMode || isPrivateMode ? (
          <Link href={accountHref} className="op-sp-btn-next">
            {t('privateMode.goToMyTemplates')}
          </Link>
        ) : (
          <Link href={galleryHref} className="op-sp-btn-next">
            {t('buttons.browseGallery')}
          </Link>
        )}
        <button type="button" className="op-sp-btn-back" onClick={onReset}>
          {isEditMode
            ? t('editMode.continueEdit')
            : isPrivateMode
              ? t('privateMode.createAnother')
              : t('buttons.submitAnother')}
        </button>
        {!isEditMode && !isPrivateMode ? (
          <Link href={accountHref} className="op-sp-btn-back">
            {t('buttons.myTemplates')}
          </Link>
        ) : null}
      </div>
      <p className="mt-4 font-mono text-[11px] text-[var(--text3)]">
        {t('success.idLabel', { id: submissionId })}
      </p>
    </div>
  );
}