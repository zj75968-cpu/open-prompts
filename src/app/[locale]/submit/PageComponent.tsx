'use client';

import '../gallery/gallery-page.css';
import './submit-page.css';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useCallback, useEffect, useMemo } from 'react';
import { useTranslations } from 'next-intl';
import type { PromptVisibility } from '~/lib/prompts/template-types';
import { isSubmitCategoryKey } from '~/lib/prompts/prompt-categories';
import { parseSubmitEditId, submitEditorHref } from '~/lib/prompts/submit-editor-path';
import { OpenPromptsSiteFooter } from '~/components/open-prompts/OpenPromptsSiteFooter';
import { OpenPromptsSiteHeader } from '~/components/open-prompts/OpenPromptsSiteHeader';
import { accountPanelHref } from '~/lib/account/account-path';
import { AssetEditor } from './AssetEditor';
import { PromptFields } from './PromptFields';
import { SourceImport } from './SourceImport';
import { SubmitLanding } from './SubmitLanding';
import { SubmitLivePreview } from './SubmitLivePreview';
import { SubmitSuccess } from './SubmitSuccess';
import { VisibilitySection } from './VisibilitySection';
import { useEditTemplateWorkflow } from './use-edit-template-workflow';
import { useSubmitFormState } from './use-submit-form-state';
import { useSubmitWorkflow } from './use-submit-workflow';
import { useXImportWorkflow } from './use-x-import-workflow';

export type SubmitPageProps = {
  locale: string;
  quickTags: string[];
};

function loginHref(locale: string, returnPath: string) {
  const base = locale === 'en' ? '/login' : `/${locale}/login`;
  return `${base}?callbackUrl=${encodeURIComponent(returnPath)}`;
}

export default function PageComponent({ locale, quickTags }: SubmitPageProps) {
  const t = useTranslations('OpenPrompts.submitPage');
  const router = useRouter();
  const searchParams = useSearchParams();
  const { status: authStatus } = useSession();

  const editId = parseSubmitEditId(searchParams?.get('edit'));
  const isEditMode = editId !== null;
  const visibilityParam = searchParams?.get('visibility');
  const isPublicMode = !isEditMode && visibilityParam === 'public';
  const isPrivateMode = !isEditMode && visibilityParam === 'private';
  const isChooserMode = !isEditMode && !isPublicMode && !isPrivateMode;
  const submitPublicPath = submitEditorHref(locale, { visibility: 'public' });
  const submitPrivatePath = submitEditorHref(locale, { visibility: 'private' });
  const submitChooserPath = submitEditorHref(locale);

  const form = useSubmitFormState();
  const saveVisibility: PromptVisibility = isEditMode
    ? form.templateVisibility
    : isPrivateMode
      ? 'private'
      : 'public';

  const {
    loading: loadingTemplate,
    error: loadError,
    reload: loadEditTemplate,
  } = useEditTemplateWorkflow({
    locale,
    editId,
    enabled: isEditMode && authStatus === 'authenticated',
    loadFailedMessage: t('editMode.loadFailed'),
    onTemplateLoaded: form.applyTemplateValues,
  });

  const xImport = useXImportWorkflow({
    locale,
    editId,
    url: form.xImportUrl,
    messages: {
      notTweet: t('xImport.errorNotTweet'),
      duplicate: t('xImport.errorDuplicate'),
      generic: t('xImport.errorGeneric'),
    },
    onUrlChange: form.setXImportUrl,
    onAuthorHandleChange: form.setAuthorHandle,
    onImported: form.applyXImportValues,
  });

  const authReturnPath =
    isEditMode && editId
      ? submitEditorHref(locale, { editId })
      : isPrivateMode
        ? submitPrivatePath
        : isPublicMode
          ? submitPublicPath
          : submitChooserPath;

  const requireAuthentication = useCallback(() => {
    router.replace(loginHref(locale, authReturnPath));
  }, [authReturnPath, locale, router]);

  useEffect(() => {
    if ((!isPrivateMode && !isEditMode) || authStatus !== 'unauthenticated') return;
    requireAuthentication();
  }, [isPrivateMode, isEditMode, authStatus, requireAuthentication]);

  const submitWorkflow = useSubmitWorkflow({
    locale,
    editId,
    isAuthenticated: authStatus === 'authenticated',
    requiresAuthentication: isPrivateMode || isEditMode,
    values: {
      title: form.title,
      description: form.desc,
      prompt: form.prompt,
      modelId: form.modelId,
      category: form.category,
      tags: form.tags,
      images: form.previewImageUrls,
      sourceUrl: form.xImportUrl,
      authorHandle: form.authorHandle,
      visibility: saveVisibility,
    },
    messages: {
      needTitle: t('validation.needTitle'),
      needPrompt: t('validation.needPrompt'),
      needCategory: t('validation.needCategory'),
      needTags: t('validation.needTags'),
      submitUnavailable: t('validation.submitUnavailable'),
      submitFailed: t('validation.submitFailed'),
      duplicateBlocked: (duplicateTitle) =>
        t('xImport.duplicateSubmitBlocked', { title: duplicateTitle }),
    },
    onAuthenticationRequired: requireAuthentication,
    onDuplicate: xImport.setDuplicate,
    onSubmitted: form.markSubmitted,
  });

  const validationChecks = useMemo(
    () => ({
      promptLength: form.prompt.trim().length >= 10,
      title: form.title.trim().length > 0,
      model: Boolean(form.modelId),
      category: isSubmitCategoryKey(form.category),
      tags: form.tags.length >= 2 && form.tags.length <= 8,
    }),
    [form.category, form.modelId, form.prompt, form.tags.length, form.title],
  );

  const resetForm = () => {
    submitWorkflow.clearBlockedHint();
    if (isEditMode) {
      void loadEditTemplate();
      return;
    }
    form.resetCreateForm();
    xImport.resetFeedback();
  };

  const editorUnavailable = isEditMode && (loadingTemplate || Boolean(loadError));

  return (
    <div className="min-h-screen w-full bg-[var(--bg)] text-[var(--text)]">
      <OpenPromptsSiteHeader locale={locale} activeNav="submit" langPathSuffix="/submit" />
      <main className="w-full">
        {isChooserMode && !form.success ? (
          <div className="op-submit-shell relative">
            <SubmitLanding publicHref={submitPublicPath} privateHref={submitPrivatePath} />
          </div>
        ) : (
        <div className="op-submit-shell relative">
          <div className="mx-auto w-full max-w-7xl px-6">
              <div className={`op-sp-page${form.success ? ' op-sp-page--simple' : ''}`}>
                <div className={`op-sp-form-area${form.success ? ' op-sp-form-area--simple' : ''}`}>
                  {form.success ? (
                    <SubmitSuccess
                      locale={locale}
                      isEditMode={isEditMode}
                      isPrivateMode={isPrivateMode}
                      authStatus={authStatus}
                      modelId={form.modelId}
                      category={form.category}
                      submissionId={form.submissionId}
                      onReset={resetForm}
                    />
                  ) : (
                  <>
                    <header className="mb-8">
                      {!isEditMode ? (
                          <Link
                            href={submitChooserPath}
                            className="mb-4 inline-block text-xs text-[var(--text3)] hover:text-[var(--amber)]"
                          >
                          {t('chooser.back')}
                        </Link>
                      ) : null}
                      <div className="op-sp-wizard-eyebrow">
                        {isEditMode
                          ? t('editMode.eyebrow')
                          : isPrivateMode
                            ? t('privateMode.eyebrow')
                            : t('wizard.eyebrow')}
                      </div>
                      <h1 className="op-sp-wizard-title">
                        {isEditMode ? (
                          <>
                            {t('editMode.title')}
                            <em>{t('editMode.titleEm')}</em>
                          </>
                        ) : isPrivateMode ? (
                          <>
                            {t('privateMode.title')}
                            <em>{t('privateMode.titleEm')}</em>
                          </>
                        ) : (
                          <>
                            {t('wizard.title')}
                            <em>{t('wizard.titleEm')}</em>
                          </>
                        )}
                      </h1>
                      <p className="op-sp-wizard-sub">
                        {isEditMode
                          ? t('editMode.subtitle')
                          : isPrivateMode
                            ? t('privateMode.subtitle')
                            : t('wizard.subtitleSimple')}
                      </p>
                    </header>

                    {isEditMode && loadError ? (
                      <div className="op-sp-info mb-6 border-[var(--coral)]/40">
                        <p className="text-[var(--coral)]">{loadError}</p>
                          <Link
                            href={accountPanelHref(locale, 'prompts')}
                            className="mt-2 inline-block text-sm text-[var(--amber)]"
                          >
                          {t('editMode.backToTemplates')}
                        </Link>
                      </div>
                    ) : null}

                    {isEditMode && loadingTemplate ? (
                      <p className="mb-6 text-sm text-[var(--text2)]">{t('editMode.loading')}</p>
                    ) : null}

                      {!editorUnavailable ? (
                        <>
                          <SourceImport
                            url={form.xImportUrl}
                            authorHandle={form.authorHandle}
                            busy={xImport.busy}
                            error={xImport.error}
                            succeeded={xImport.succeeded}
                            duplicate={xImport.duplicate}
                            onImportUrlChange={xImport.changeImportUrl}
                            onSourceUrlChange={xImport.changeSourceUrl}
                            onAuthorHandleChange={form.setAuthorHandle}
                            onImport={xImport.runImport}
                          />
                          <PromptFields
                            quickTags={quickTags}
                            title={form.title}
                            description={form.desc}
                            modelId={form.modelId}
                            category={form.category}
                            tags={form.tags}
                            prompt={form.prompt}
                            shakeId={submitWorkflow.shakeId}
                            onTitleChange={form.setTitle}
                            onDescriptionChange={form.setDesc}
                            onModelChange={form.setModelId}
                            onCategoryChange={form.setCategory}
                            onAddTag={form.addTag}
                            onRemoveTag={form.removeTag}
                            onPromptChange={form.setPrompt}
                          />
                          <AssetEditor
                            images={form.resultImages}
                            imagesFull={form.imagesFull}
                            onAppendImages={form.appendImages}
                            onAddImage={form.addImageUrl}
                            onRemoveImage={form.removeImage}
                          />
                          <VisibilitySection
                            isEditMode={isEditMode}
                            isPrivateMode={isPrivateMode}
                            submitting={submitWorkflow.submitting}
                            blockedHint={submitWorkflow.blockedHint}
                            prompt={form.prompt}
                            checks={validationChecks}
                            onSubmit={submitWorkflow.submit}
                          />
                        </>
                      ) : null}
                      </>
                    )}
                    </div>

                {!form.success && !editorUnavailable ? (
                  <SubmitLivePreview
                    title={form.title}
                    description={form.desc}
                    prompt={form.prompt}
                    modelId={form.modelId}
                    category={form.category}
                    tags={form.tags}
                    images={form.previewImageUrls}
                  />
              ) : null}
            </div>
          </div>
        </div>
        )}
      </main>
      <OpenPromptsSiteFooter locale={locale} />
    </div>
  );
}