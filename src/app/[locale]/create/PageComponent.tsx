'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import { OpenPromptsSiteFooter } from '~/components/open-prompts/OpenPromptsSiteFooter';
import { OpenPromptsSiteHeader } from '~/components/open-prompts/OpenPromptsSiteHeader';
import { PromptGallerySwipeViewer } from '~/components/prompt-gallery/PromptGallerySwipeViewer';
import type { PromptGalleryItem } from '~/lib/prompts/prompt-model';
import { CreateMainPanel } from './CreateMainPanel';
import { GenerationResult } from './GenerationResult';
import { HistoryPanel } from './HistoryPanel';
import { ModelSettings } from './ModelSettings';
import { PromptEditor } from './PromptEditor';
import { TemplatePanel } from './TemplatePanel';
import { imageProxyUrls } from './create-api';
import type {
  CreateHeroBlock,
  GenerationHistoryEntry,
  InternalConfigCopy,
  SwipeViewerState,
} from './types';
import { useAutomaticAspectRatio } from './use-automatic-aspect-ratio';
import { useCreateTemplateSelection } from './use-create-template-selection';
import { useGenerationHistory } from './use-generation-history';
import { useGenerationJob } from './use-generation-job';
import { useGenerationSettings } from './use-generation-settings';

type Props = { locale: string; prompts: PromptGalleryItem[] };

type ViewerOptions = {
  title?: string;
  prefix?: string;
  showDownload?: boolean;
};

export default function PageComponent({ locale, prompts }: Props) {
  const t = useTranslations('OpenPrompts');
  const {
    query,
    setQuery,
    selectedId,
    setSelectedId,
    item,
    filteredTemplates,
    heroCarouselItems,
  } = useCreateTemplateSelection(prompts);
  const [promptText, setPromptText] = useState('');
  const [swipeViewer, setSwipeViewer] = useState<SwipeViewerState | null>(null);

  const {
    provider,
    setProvider,
    aspectRatio,
    setAspectRatio,
    aspectTouched,
    setAspectTouched,
    model,
    setModel,
    quality,
    setQuality,
    count,
    setCount,
    capabilities,
    modelOptions,
    applySettings,
    getApiKeyOverride,
    saveApiKeyOverride,
    clearApiKeyOverride,
  } = useGenerationSettings({
    templateId: selectedId,
    templateModel: item?.model,
  });

  const generationMessages = useMemo(
    () => ({
      missingPrompt: t('gen.missingPrompt'),
      createFailed: t('gen.createFailed'),
      generationFailed: t('gen.generationFailed'),
      pollingFailed: t('gen.pollingFailed'),
    }),
    [t],
  );

  const {
    uiState,
    providerJobId,
    images,
    error,
    canGenerate,
    resetGeneration,
    restoreGeneration,
    startGeneration,
  } = useGenerationJob({
    locale,
    provider,
    getApiKeyOverride,
    messages: generationMessages,
  });

  const { history, deleteHistoryEntry } = useGenerationHistory({
    uiState,
    images,
    providerJobId,
    prompt: promptText,
    model: model || item?.model || 'GPT Image 2',
    provider,
    aspectRatio,
    quality,
    count,
  });

  useEffect(() => {
    setPromptText(item?.prompt ?? '');
    resetGeneration();
  }, [selectedId, item?.prompt, resetGeneration]);

  const automaticAspectSource =
    uiState === 'succeeded' && images[0]
      ? images[0]
      : aspectTouched
        ? null
        : item?.images[0];
  useAutomaticAspectRatio({
    source: automaticAspectSource,
    aspectRatios: capabilities.aspectRatios,
    setAspectRatio,
  });

  const openViewer = (
    viewerImages: string[],
    index: number,
    options?: ViewerOptions,
  ) => {
    const proxiedImages = imageProxyUrls(locale, viewerImages.filter(Boolean));
    if (!proxiedImages.length) return;
    setSwipeViewer({
      images: proxiedImages,
      initialIndex: Math.max(0, Math.min(index, proxiedImages.length - 1)),
      title: options?.title ?? '',
      imageKeyPrefix: options?.prefix ?? 'output',
      showDownload: options?.showDownload ?? true,
    });
  };

  const generate = async () => {
    await startGeneration({
      provider,
      prompt: promptText,
      apiKey:
        provider === 'internal'
          ? undefined
          : getApiKeyOverride(provider) || undefined,
      model: model || item?.model || 'GPT Image 2',
      aspectRatio,
      quality,
      count,
    });
  };

  const restoreHistoryEntry = (entry: GenerationHistoryEntry) => {
    applySettings(entry);
    setPromptText(entry.prompt);
    restoreGeneration(entry);
  };

  const hero = useMemo(
    () => t.raw('createPage.hero' as any) as CreateHeroBlock,
    [t],
  );

  const internalConfigHint = useMemo(() => {
    if (provider !== 'internal' || !error) return null;
    const missingConfiguration =
      error.includes('Missing ATLASCLOUD_BASE_URL') ||
      error.includes('Missing ATLASCLOUD_API_KEY') ||
      error.includes('Missing REPLICATE_API_TOKEN') ||
      error.includes('Missing REPLICATE_MODEL') ||
      error.includes('Missing REPLICATE_VERSION') ||
      error.toLowerCase().includes('unknown provider');
    return missingConfiguration
      ? (t.raw('createPage.internalConfig' as any) as InternalConfigCopy)
      : null;
  }, [error, provider, t]);

  const workbench = (
    <div className="rounded-2xl border border-[var(--border2)] bg-[color-mix(in_oklab,var(--bg)_70%,var(--surface))] shadow-sm">
      <PromptEditor prompt={promptText} onPromptChange={setPromptText} />
      <ModelSettings
        provider={provider}
        model={model}
        fallbackModel={item?.model}
        modelOptions={modelOptions}
        aspectRatio={aspectRatio}
        quality={quality}
        count={count}
        capabilities={capabilities}
        canGenerate={canGenerate}
        generating={uiState === 'queued' || uiState === 'running'}
        onProviderChange={setProvider}
        onModelChange={setModel}
        onAspectRatioChange={(nextAspectRatio) => {
          setAspectTouched(true);
          setAspectRatio(nextAspectRatio);
        }}
        onQualityChange={setQuality}
        onCountChange={setCount}
        onGenerate={() => {
          void generate();
        }}
        getApiKeyOverride={getApiKeyOverride}
        saveApiKeyOverride={saveApiKeyOverride}
        clearApiKeyOverride={clearApiKeyOverride}
      />
    </div>
  );

  const generationError =
    uiState === 'failed' ? (
      <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
        {t('gen.failedPrefix')}
        {error || t('gen.tryAgain')}
        {internalConfigHint ? (
          <div className="mt-3 rounded-lg border border-[var(--border)] bg-[color-mix(in_oklab,var(--bg)_70%,transparent)] p-3 text-[12px] text-[var(--text2)]">
            <div className="font-semibold text-[var(--text)]">
              {internalConfigHint.title}
            </div>
            <div className="mt-1">{internalConfigHint.body}</div>
            <ul className="mt-2 list-disc space-y-1 pl-5">
              {internalConfigHint.steps.map((step) => (
                <li key={step} className="whitespace-pre-wrap">
                  {step}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>
    ) : null;

  return (
    <>
      <style jsx global>{`
        html,
        body {
          height: 100%;
          overflow: hidden;
        }
      `}</style>

      <div className="flex h-screen w-full flex-col bg-[var(--bg)] text-[var(--text)]">
        <OpenPromptsSiteHeader
          locale={locale}
          activeNav="create"
          langPathSuffix="/create"
          stickyZClass="z-50"
          submitCtaSuffix=" →"
        />

        <div className="mx-auto h-[calc(100vh-56px-73px)] min-h-0 w-full max-w-7xl overflow-hidden rounded-none border-x border-[var(--border2)] shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
          <div className="grid h-full min-h-0 w-full grid-cols-1 overflow-hidden md:grid-cols-[260px_1fr] lg:grid-cols-[260px_1fr_300px]">
            <TemplatePanel
              query={query}
              selectedId={selectedId}
              selectedItem={item}
              templates={filteredTemplates}
              onQueryChange={setQuery}
              onSelect={setSelectedId}
              onOpenViewer={openViewer}
            />

            <CreateMainPanel
              locale={locale}
              prompts={prompts}
              hero={hero}
              carouselItems={heroCarouselItems}
              workbench={workbench}
              generationError={generationError}
              onSelectTemplate={setSelectedId}
              onOpenViewer={openViewer}
            />

            <aside className="relative z-30 hidden min-h-0 flex-col border-l border-[var(--border2)] bg-[color-mix(in_oklab,var(--bg)_70%,var(--surface))] shadow-[inset_1px_0_0_rgba(255,255,255,0.04)] lg:flex">
              <div className="flex items-center justify-between border-b border-[var(--border)] p-4">
                <div className="text-[11px] font-medium tracking-[0.08em] text-[var(--text2)]">
                  {t('createPage.resultHistoryLabel')}
                </div>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto p-4">
                <GenerationResult
                  locale={locale}
                  uiState={uiState}
                  providerJobId={providerJobId}
                  images={images}
                  count={count}
                  onOpenViewer={(viewerImages, index) =>
                    openViewer(viewerImages, index)
                  }
                />
                <HistoryPanel
                  locale={locale}
                  history={history}
                  onSelect={restoreHistoryEntry}
                  onDelete={deleteHistoryEntry}
                  onOpenViewer={(viewerImages, index, prefix) =>
                    openViewer(viewerImages, index, { prefix })
                  }
                />
              </div>
            </aside>
          </div>
        </div>

        <OpenPromptsSiteFooter locale={locale} spacing="flush" />
      </div>

      {swipeViewer ? (
        <PromptGallerySwipeViewer
          open
          onClose={() => setSwipeViewer(null)}
          images={swipeViewer.images}
          title={swipeViewer.title}
          imageKeyPrefix={swipeViewer.imageKeyPrefix}
          initialIndex={swipeViewer.initialIndex}
          coverLoadFailedText={t('gallery.coverLoadFailed')}
          showDownloadButton={swipeViewer.showDownload}
          downloadTitle={t('createPage.downloadTitle')}
          closeLabel={t('createPage.viewerClose')}
          prevLabel={t('createPage.viewerPrev')}
          nextLabel={t('createPage.viewerNext')}
          overlayClassName="bg-black/80"
        />
      ) : null}
    </>
  );
}