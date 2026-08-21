'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import type { PromptGalleryItem } from '~/lib/prompts/prompt-model';
import { CoverImage } from '~/components/prompt-gallery/CoverImage';
import { PromptGalleryCard } from '~/components/prompt-gallery/PromptGalleryCard';
import { PromptGallerySwipeViewer } from '~/components/prompt-gallery/PromptGallerySwipeViewer';
import { OpenPromptsSiteFooter } from '~/components/open-prompts/OpenPromptsSiteFooter';
import { OpenPromptsSiteHeader } from '~/components/open-prompts/OpenPromptsSiteHeader';
import { HiDotsHorizontal } from 'react-icons/hi';
import { LuCheck, LuChevronDown, LuHash, LuLayers, LuMaximize2, LuShield, LuSquare } from 'react-icons/lu';
import { FaCubes } from 'react-icons/fa';
import { TbCloud } from 'react-icons/tb';
import { downloadImageWithRandomName, pickClosestAspectRatio, proxifyImageList, proxifyImageUrl } from './create-utils';
import type { CreateHeroBlock, InternalConfigCopy, SwipeViewerState } from './types';
import { useCreateTemplateSelection } from './use-create-template-selection';
import { useGenerationHistory } from './use-generation-history';
import { useGenerationJob } from './use-generation-job';
import { useGenerationSettings } from './use-generation-settings';

type Props = { locale: string; prompts: PromptGalleryItem[] };

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
  const [heroCarouselIdx, setHeroCarouselIdx] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [ratioById, setRatioById] = useState<Record<string, string>>({});

  const [promptText, setPromptText] = useState('');

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
    getApiKeyOverride,
    saveApiKeyOverride,
    clearApiKeyOverride,
  } = useGenerationSettings({
    templateId: selectedId,
    templateModel: item?.model,
  });
  const prevProviderRef = useRef<string>(provider);
  /** null = closed; non-null = open at fixed viewport position */
  const [moreMenu, setMoreMenu] = useState<{ top: number; left: number } | null>(null);
  const moreWrapRef = useRef<HTMLDivElement | null>(null);
  const [openPopover, setOpenPopover] = useState<null | 'model' | 'ratio' | 'quality' | 'count'>(null);
  const [keyDialogOpen, setKeyDialogOpen] = useState(false);
  const [keyDialogProvider, setKeyDialogProvider] = useState<string>(provider);
  const [keyDraft, setKeyDraft] = useState('');

  const applyClosestAspectRatio = (w: number, h: number, options: string[]) =>
    pickClosestAspectRatio(w, h, options);

  useEffect(() => {
    if (aspectTouched) return;
    const src = item?.images?.[0];
    if (!src) return;

    let cancelled = false;
    const img = new (globalThis as any).Image();
    img.decoding = 'async';
    img.loading = 'eager';
    img.onload = () => {
      if (cancelled) return;
      const w = Number(img.naturalWidth || 0);
      const h = Number(img.naturalHeight || 0);
      if (!w || !h) return;
      const next = applyClosestAspectRatio(w, h, capabilities.aspectRatios);
      setAspectRatio((prev) => (prev === next ? prev : next));
    };
    img.onerror = () => {
      // ignore
    };
    img.src = src;

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item?.id, item?.images, capabilities.aspectRatios, aspectTouched]);

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
    setUiState,
    providerJobId,
    setProviderJobId,
    images,
    setImages,
    error,
    canGenerate,
    resetGeneration,
    startGeneration,
  } = useGenerationJob({
    locale,
    provider,
    getApiKeyOverride,
    messages: generationMessages,
  });
  const [ratioByUrl, setRatioByUrl] = useState<Record<string, string>>({});
  const [copied, setCopied] = useState(false);
  const { history, setHistory } = useGenerationHistory({
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
  const [swipeViewer, setSwipeViewer] = useState<SwipeViewerState | null>(null);

  useEffect(() => {
    if (uiState !== 'succeeded') return;
    const src = images?.[0];
    if (!src) return;

    let cancelled = false;
    const img = new (globalThis as any).Image();
    img.decoding = 'async';
    img.loading = 'eager';
    img.onload = () => {
      if (cancelled) return;
      const w = Number(img.naturalWidth || 0);
      const h = Number(img.naturalHeight || 0);
      if (!w || !h) return;
      const next = applyClosestAspectRatio(w, h, capabilities.aspectRatios);
      setAspectRatio((prev) => (prev === next ? prev : next));
    };
    img.onerror = () => {
      // ignore
    };
    img.src = src;

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uiState, images?.[0], capabilities.aspectRatios]);

  const openViewer = (
    list: string[],
    idx: number,
    opts?: { title?: string; prefix?: string; showDownload?: boolean }
  ) => {
    const proxied = proxifyImageList(locale, list.filter(Boolean));
    if (!proxied.length) return;
    const maxIdx = proxied.length - 1;
    setSwipeViewer({
      images: proxied,
      initialIndex: Math.max(0, Math.min(idx, maxIdx)),
      title: opts?.title ?? '',
      imageKeyPrefix: opts?.prefix ?? 'output',
      showDownload: opts?.showDownload ?? true,
    });
  };

  useEffect(() => {
    const mq = globalThis?.window?.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const apply = () => setReduceMotion(Boolean(mq.matches));
    apply();
    mq.addEventListener?.('change', apply);
    return () => mq.removeEventListener?.('change', apply);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    if (heroCarouselItems.length <= 1) return;
    const id = window.setInterval(() => {
      setHeroCarouselIdx((i) => (i + 1) % heroCarouselItems.length);
    }, 2600);
    return () => window.clearInterval(id);
  }, [reduceMotion, heroCarouselItems.length]);

  const providerMeta = useMemo(() => {
    const map: Record<string, { label: string; Icon: any }> = {
      internal: { label: 'internal', Icon: LuShield },
      atlascloud: { label: 'atlascloud', Icon: TbCloud },
      replicate: { label: 'replicate', Icon: FaCubes },
    };
    return map;
  }, []);

  const providerLabel = (p: string) => {
    if (p === 'internal') return t('createPage.providerInternal');
    return p;
  };

  const selectProvider = (next: string) => {
    if (next === provider) return;
    if (next === 'internal') {
      setKeyDialogOpen(false);
      setProvider('internal');
      return;
    }
    prevProviderRef.current = provider;
    setProvider(next);
    setKeyDialogProvider(next);
    setKeyDraft(getApiKeyOverride(next));
    setKeyDialogOpen(true);
  };

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as Node | null;
      if (!target) return;
      const el = moreWrapRef.current;
      if (el?.contains(target)) return;
      if ((e.target as HTMLElement | null)?.closest?.('[data-op-more-menu]')) return;
      setMoreMenu(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  useEffect(() => {
    const onPointerDown = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      // Keep popovers open when interacting inside them.
      if (target.closest('[data-op-popover]')) return;
      setOpenPopover(null);
    };
    document.addEventListener('pointerdown', onPointerDown);
    return () => document.removeEventListener('pointerdown', onPointerDown);
  }, []);

  useEffect(() => {
    setPromptText(item?.prompt ?? '');
    resetGeneration();
  }, [selectedId, item?.prompt, resetGeneration]);

  const hero = useMemo(() => t.raw('createPage.hero' as any) as CreateHeroBlock, [t]);

  const onGenerate = async () => {
    await startGeneration({
      provider,
      prompt: promptText,
      apiKey: provider === 'internal' ? undefined : getApiKeyOverride(provider) || undefined,
      model: model || item?.model || 'GPT Image 2',
      aspectRatio,
      quality,
      count,
    });
  };

  const internalConfigHint = useMemo(() => {
    if (provider !== 'internal') return null;
    const msg = String(error || '');
    if (!msg) return null;

    const looksLikeMissingKey =
      msg.includes('Missing ATLASCLOUD_BASE_URL') ||
      msg.includes('Missing ATLASCLOUD_API_KEY') ||
      msg.includes('Missing REPLICATE_API_TOKEN') ||
      msg.includes('Missing REPLICATE_MODEL') ||
      msg.includes('Missing REPLICATE_VERSION') ||
      msg.toLowerCase().includes('unknown provider');

    if (!looksLikeMissingKey) return null;

    return t.raw('createPage.internalConfig' as any) as InternalConfigCopy;
  }, [provider, error, t]);

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
          githubAriaLabel={t('createPage.githubRepoAriaLabel')}
          githubTitle={t('createPage.githubTitle')}
          submitCtaSuffix=" →"
        />

        <div className="mx-auto min-h-0 h-[calc(100vh-56px-73px)] w-full max-w-7xl overflow-hidden rounded-none border-x border-[var(--border2)] shadow-[0_0_0_1px_rgba(0,0,0,0.05)]">
          <div className="grid min-h-0 h-full w-full grid-cols-1 overflow-hidden md:grid-cols-[260px_1fr] lg:grid-cols-[260px_1fr_300px]">
            {/* Left rail */}
            <aside className="relative z-30 hidden min-h-0 flex-col border-r border-[var(--border2)] bg-[color-mix(in_oklab,var(--bg)_70%,var(--surface))] md:flex shadow-[inset_-1px_0_0_rgba(255,255,255,0.04)]">
            <div className="border-b border-[var(--border)] px-4 py-3">
              <div className="text-[11px] font-medium tracking-[0.08em] text-[var(--text2)]">
                {t('createPage.templatesLabel')}
              </div>
            </div>
            <div className="border-b border-[var(--border)] p-3">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t('createPage.searchTemplatesPlaceholder')}
                className="w-full rounded-lg border border-[var(--border2)] bg-[var(--surface)] px-3 py-2 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text3)] focus:border-[var(--amber)]"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <div className="flex flex-col gap-2">
                {filteredTemplates.map((p) => {
                  const selected = p.id === selectedId;
                  const src = p.images?.[0];
                  return (
                    <div
                      key={p.id}
                      role="button"
                      tabIndex={0}
                      title={p.title}
                      onClick={() => setSelectedId(p.id)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSelectedId(p.id);
                        }
                      }}
                      className={`group relative w-full cursor-pointer overflow-hidden rounded-lg border transition outline-none focus-visible:ring-2 focus-visible:ring-[var(--amber)] ${
                        selected
                          ? 'border-[var(--amber)] shadow-[0_0_0_2px_color-mix(in_oklab,var(--amber)_30%,transparent)]'
                          : 'border-[var(--border)] hover:border-[var(--border2)]'
                      }`}
                    >
                      <div
                        className="w-full bg-[var(--surface2)]"
                        style={{ aspectRatio: ratioById[p.id] ?? '4 / 3' }}
                      >
                        {src ? (
                          <CoverImage
                            src={src}
                            alt={p.title}
                            sizes="280px"
                            className="object-contain"
                            errorText={t('gallery.coverLoadFailed')}
                            onMeta={({ width, height }) => {
                              const ar = `${width} / ${height}`;
                              setRatioById((prev) => (prev[p.id] === ar ? prev : { ...prev, [p.id]: ar }));
                            }}
                          />
                        ) : (
                          <div className="grid h-full w-full place-items-center text-xs text-[var(--text3)]">—</div>
                        )}
                      </div>
                      <div className="pointer-events-none absolute inset-0 bg-black/0 transition group-hover:bg-black/10" />
                      {src ? (
                        <button
                          type="button"
                          className="absolute right-2 top-2 z-10 grid h-7 w-7 place-items-center rounded-md bg-black/55 text-white/90 opacity-90 shadow-sm transition hover:bg-black/70 md:opacity-0 md:group-hover:opacity-100"
                          title={t('createPage.fullscreenTitle')}
                          aria-label={t('createPage.fullscreenTitle')}
                          onClick={(e) => {
                            e.stopPropagation();
                            openViewer(p.images, 0, {
                              title: p.title,
                              prefix: p.id,
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
                    className="text-[11px] text-[var(--text3)] hover:text-[var(--amber)]"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(item?.prompt ?? '');
                        setCopied(true);
                      } finally {
                        window.setTimeout(() => setCopied(false), 900);
                      }
                    }}
                  >
                    {copied ? t('modal.copied') : t('modal.copy')}
                  </button>
                </div>
                <div className="mt-2 max-h-28 overflow-y-auto whitespace-pre-wrap font-mono text-[11px] leading-relaxed text-[var(--text2)]">
                  {item?.prompt ?? ''}
                </div>
              </div>
            </div>
            </aside>

            {/* Center */}
            <main className="relative z-10 flex min-h-0 flex-col overflow-hidden bg-[var(--surface)]">
            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              <section className="py-6">
                <div className="mx-auto max-w-3xl text-center">
                  <div className="mx-auto inline-flex items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface2)] px-3 py-1 text-[11px] font-medium text-[var(--text2)]">
                    <span className="grid h-4 w-4 place-items-center rounded-full bg-[color-mix(in_oklab,var(--amber)_18%,transparent)] text-[var(--amber2)]">
                      ✦
                    </span>
                    <span>{t('createPage.brandPill')}</span>
                  </div>

                  <h1 className="mt-6 text-4xl font-semibold tracking-tight leading-[1.06] text-[var(--text)] sm:text-5xl md:text-6xl">
                    <span className="block">{hero.titleLine1}</span>
                    <span className="block">
                      {hero.titleLine2Before}
                      <span className="italic">{hero.titleLine2Em}</span>
                      {hero.titleLine2After}
                    </span>
                  </h1>
                  <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-[var(--text2)] sm:text-lg">
                    {hero.subtitle}
                  </p>
                  <div className="mt-3 flex items-center justify-center">
                    <button
                      type="button"
                      className="group inline-flex max-w-[min(520px,92vw)] items-center gap-2 rounded-full border border-[var(--border)] bg-[var(--surface2)] px-4 py-2 text-[12px] text-[var(--text2)] hover:border-[var(--border2)] hover:text-[var(--text)]"
                      title={t('createPage.carouselApplyTitle')}
                      onClick={() => {
                        const p = heroCarouselItems[heroCarouselIdx];
                        if (!p?.id) return;
                        setSelectedId(p.id);
                        const el = document.getElementById('op-create-prompt');
                        el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      }}
                    >
                      <span className="shrink-0 rounded-full border border-[color-mix(in_oklab,var(--amber)_25%,transparent)] bg-[color-mix(in_oklab,var(--amber)_12%,transparent)] px-2 py-0.5 text-[10px] font-medium tracking-[0.12em] text-[var(--amber2)]">
                        {t('createPage.carouselPromptBadge')}
                      </span>
                      <span
                        key={heroCarouselItems[heroCarouselIdx]?.id || heroCarouselIdx}
                        className="truncate"
                      >
                        {heroCarouselItems[heroCarouselIdx]?.title || ''}
                      </span>
                      <span className="shrink-0 text-[var(--text3)] group-hover:text-[var(--amber)]">→</span>
                    </button>
                  </div>
                 
                </div>
              </section>

              <div className="rounded-2xl border border-[var(--border2)] bg-[color-mix(in_oklab,var(--bg)_70%,var(--surface))] shadow-sm">
                <div className="border-b border-[var(--border)] p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-[11px] font-medium tracking-[0.08em] text-[var(--text2)]">
                      {t('createPage.promptSectionLabel')}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        className="rounded-lg border border-[var(--border2)] bg-[var(--surface)] px-3 py-1.5 text-[11px] text-[var(--text2)] hover:text-[var(--text)]"
                        onClick={async () => {
                          try {
                            await navigator.clipboard.writeText(promptText);
                            setCopied(true);
                          } finally {
                            window.setTimeout(() => setCopied(false), 900);
                          }
                        }}
                      >
                        {copied ? t('modal.copied') : t('modal.copy')}
                      </button>
                      <button
                        className="rounded-lg border border-[color-mix(in_oklab,var(--amber)_35%,transparent)] bg-[color-mix(in_oklab,var(--amber)_12%,transparent)] px-3 py-1.5 text-[11px] text-[var(--amber2)]"
                        onClick={() => setPromptText((x) => x.trim() + (x.includes('highly detailed') ? '' : ', highly detailed'))}
                      >
                        {t('createPage.enhanceButton')}
                      </button>
                    </div>
                  </div>

                  <textarea
                    id="op-create-prompt"
                    className="h-48 w-full resize-none rounded-xl border border-[var(--border2)] bg-[var(--surface)] p-4 text-[12.5px] leading-relaxed text-[var(--text)] outline-none placeholder:text-[var(--text3)] focus:border-[var(--amber)]"
                    value={promptText}
                    onChange={(e) => setPromptText(e.target.value)}
                    placeholder={t('createPage.promptPlaceholder')}
                  />

                  <div className="mt-2 flex items-center justify-between text-[10px] text-[var(--text3)]">
                    <span>{promptText.length} / 2000</span>
                  </div>
                </div>

                <div className="p-3">
                  <div className="flex flex-wrap items-center gap-2">
                  <div className="relative" data-op-popover>
                    <button
                      type="button"
                      className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--ctl-border)] bg-[var(--ctl-bg)] px-3 text-[12px] text-[var(--text2)] hover:bg-[var(--ctl-hover)]"
                      onClick={() => setOpenPopover((v) => (v === 'model' ? null : 'model'))}
                      title={t('createPage.modelTitle')}
                    >
                      <span className="grid h-5 w-5 place-items-center rounded-md bg-[color-mix(in_oklab,var(--ctl-bg)_70%,transparent)] text-[var(--text3)]">
                        ✦
                      </span>
                      <span className="max-w-[180px] truncate text-[var(--text)]">
                        {modelOptions.find((m) => String(m.value ?? m.label) === model)?.label ||
                          modelOptions[0]?.label ||
                          model ||
                          item?.model ||
                          'GPT Image 2'}
                      </span>
                      <LuChevronDown className="h-4 w-4 text-[var(--text3)]" aria-hidden="true" />
                    </button>
                    {openPopover === 'model' ? (
                      <div className="absolute left-0 z-20 mt-2 w-72 overflow-hidden rounded-xl border border-[var(--ctl-border)] bg-[var(--panel-bg)] shadow-xl">
                        <div className="border-b border-[var(--border)] px-4 py-3 text-xs font-medium text-[var(--text2)]">
                          {t('createPage.selectModel')}
                        </div>
                        <div className="p-1">
                          {modelOptions.map((m) => {
                            const v = String(m.value ?? m.label);
                            const active = v === model;
                            return (
                              <button
                                key={v}
                                type="button"
                                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm ${
                                  active ? 'bg-[var(--surface2)] text-[var(--text)]' : 'text-[var(--text)] hover:bg-[var(--surface2)]'
                                }`}
                                onClick={() => {
                                  setModel(v);
                                  setOpenPopover(null);
                                }}
                              >
                                <span className="truncate">{m.label}</span>
                                {active ? <LuCheck className="h-4 w-4 text-[var(--amber)]" aria-hidden="true" /> : null}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {(() => {
                    const labelForRatio = (ar: string) => {
                      const s = String(ar);
                      if (s === '1:1') return t('createPage.ratioSquare', { ratio: s });
                      if (s === '2:1') return t('createPage.ratioUltraWide', { ratio: s });
                      if (s === '16:9' || s === '4:3' || s === '3:2' || s === '5:4')
                        return t('createPage.ratioLandscape', { ratio: s });
                      if (s === '9:16' || s === '3:4' || s === '2:3' || s === '4:5')
                        return t('createPage.ratioPortrait', { ratio: s });
                      return s;
                    };
                    const shortRatio = (ar: string) => String(ar || '').trim();
                    const RatioGlyph = ({ ar }: { ar: string }) => {
                      const s = String(ar || '').trim();
                      const [aRaw, bRaw] = s.split(':');
                      const a = Number(aRaw);
                      const b = Number(bRaw);
                      const ratio = a > 0 && b > 0 ? a / b : 1;
                      // Fit a ratio box into a 18x18 container.
                      const max = 14;
                      const w = ratio >= 1 ? max : Math.max(6, Math.round(max * ratio));
                      const h = ratio >= 1 ? Math.max(6, Math.round(max / ratio)) : max;
                      return (
                        <span className="grid h-5 w-5 place-items-center rounded-md border border-[var(--border)] bg-[var(--surface2)]">
                          <span
                            className="block rounded-[3px] border border-[var(--border2)] bg-[color-mix(in_oklab,var(--surface)_70%,transparent)]"
                            style={{ width: `${w}px`, height: `${h}px` }}
                          />
                        </span>
                      );
                    };
                    return (
                      <div className="relative" data-op-popover>
                        <button
                          type="button"
                          className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--ctl-border)] bg-[var(--ctl-bg)] px-3 text-[12px] text-[var(--text2)] hover:bg-[var(--ctl-hover)]"
                          onClick={() => setOpenPopover((v) => (v === 'ratio' ? null : 'ratio'))}
                          title={t('gen.aspectRatio')}
                        >
                          <RatioGlyph ar={aspectRatio} />
                          <span className="text-[var(--text)]">{shortRatio(aspectRatio)}</span>
                          <LuChevronDown className="h-4 w-4 text-[var(--text3)]" aria-hidden="true" />
                        </button>
                        {openPopover === 'ratio' ? (
                          <div className="absolute left-1/2 z-20 mt-2 w-72 -translate-x-1/2 overflow-hidden rounded-xl border border-[var(--ctl-border)] bg-[var(--panel-bg)] shadow-xl">
                            <div className="border-b border-[var(--border)] px-4 py-3 text-xs font-medium text-[var(--text2)]">
                              {t('createPage.selectImageRatio')}
                            </div>
                            <div className="max-h-[320px] overflow-y-auto p-1">
                              {capabilities.aspectRatios.map((v) => {
                                const active = v === aspectRatio;
                                return (
                                  <button
                                    key={v}
                                    type="button"
                                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm ${
                                      active
                                        ? 'bg-[var(--surface2)] text-[var(--text)]'
                                        : 'text-[var(--text)] hover:bg-[var(--surface2)]'
                                    }`}
                                    onClick={() => {
                                      setAspectTouched(true);
                                      setAspectRatio(v);
                                      setOpenPopover(null);
                                    }}
                                  >
                                    <span className="inline-flex items-center gap-2">
                                      <RatioGlyph ar={v} />
                                      <span>{labelForRatio(v)}</span>
                                    </span>
                                    {active ? <LuCheck className="h-4 w-4 text-[var(--amber)]" aria-hidden="true" /> : null}
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })()}

                  <div className="relative" data-op-popover>
                    <button
                      type="button"
                      className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--ctl-border)] bg-[var(--ctl-bg)] px-3 text-[12px] text-[var(--text2)] hover:bg-[var(--ctl-hover)]"
                      onClick={() => setOpenPopover((v) => (v === 'quality' ? null : 'quality'))}
                      title={t('gen.quality')}
                    >
                      <LuLayers className="h-4 w-4 text-[var(--text3)]" aria-hidden="true" />
                      <span className="text-[var(--text)]">{quality}</span>
                      <LuChevronDown className="h-4 w-4 text-[var(--text3)]" aria-hidden="true" />
                    </button>
                    {openPopover === 'quality' ? (
                      <div className="absolute left-0 z-20 mt-2 w-72 overflow-hidden rounded-xl border border-[var(--ctl-border)] bg-[var(--panel-bg)] shadow-xl">
                        <div className="border-b border-[var(--border)] px-4 py-3 text-xs font-medium text-[var(--text2)]">
                          {t('createPage.qualityPopoverTitle')}
                        </div>
                        <div className="p-1">
                          {capabilities.qualities.map((q) => {
                            const active = q === quality;
                            return (
                              <button
                                key={q}
                                type="button"
                                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm ${
                                  active ? 'bg-[var(--surface2)] text-[var(--text)]' : 'text-[var(--text)] hover:bg-[var(--surface2)]'
                                }`}
                                onClick={() => {
                                  setQuality(q);
                                  setOpenPopover(null);
                                }}
                              >
                                <span className="inline-flex items-center gap-2">
                                  {active ? (
                                    <LuCheck className="h-4 w-4 text-[var(--amber)]" aria-hidden="true" />
                                  ) : (
                                    <span className="h-4 w-4" />
                                  )}
                                  <span>
                                    {q}
                                    {q === '1k' ? t('createPage.qualityDefaultSuffix') : ''}
                                  </span>
                                </span>
                                {active ? (
                                  <span className="text-xs text-[var(--text3)]">
                                    {t('createPage.qualityActive')}
                                  </span>
                                ) : null}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <div className="relative" data-op-popover>
                    <button
                      type="button"
                      className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--ctl-border)] bg-[var(--ctl-bg)] px-3 text-[12px] text-[var(--text2)] hover:bg-[var(--ctl-hover)]"
                      onClick={() => setOpenPopover((v) => (v === 'count' ? null : 'count'))}
                      title={t('gen.count')}
                    >
                      <LuHash className="h-4 w-4 text-[var(--text3)]" aria-hidden="true" />
                      <span className="text-[var(--text)]">{count}</span>
                      <LuChevronDown className="h-4 w-4 text-[var(--text3)]" aria-hidden="true" />
                    </button>
                    {openPopover === 'count' ? (
                      <div className="absolute right-0 z-20 mt-2 w-40 overflow-hidden rounded-xl border border-[var(--ctl-border)] bg-[var(--panel-bg)] shadow-xl">
                        <div className="border-b border-[var(--border)] px-4 py-3 text-xs font-medium text-[var(--text2)]">
                          {t('createPage.generateCountTitle')}
                        </div>
                        <div className="max-h-[320px] overflow-y-auto p-1">
                          {Array.from({ length: capabilities.maxCount }, (_, i) => i + 1).map((n) => {
                            const active = n === count;
                            return (
                              <button
                                key={n}
                                type="button"
                                className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm ${
                                  active ? 'bg-[var(--surface2)] text-[var(--text)]' : 'text-[var(--text)] hover:bg-[var(--surface2)]'
                                }`}
                                onClick={() => {
                                  setCount(n);
                                  setOpenPopover(null);
                                }}
                              >
                                <span>{n}</span>
                                {active ? <LuCheck className="h-4 w-4 text-[var(--amber)]" aria-hidden="true" /> : null}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ) : null}
                  </div>

                  <button
                    disabled={!canGenerate}
                    onClick={onGenerate}
                    className="ml-auto h-9 rounded-full bg-[var(--amber)] px-5 text-[12px] font-semibold text-[var(--bg)] disabled:opacity-50"
                  >
                    {uiState === 'queued' || uiState === 'running' ? t('gen.generating') : t('gen.generate')}
                  </button>

                  <div className="relative" ref={moreWrapRef}>
                    <button
                      type="button"
                      className="grid h-9 w-9 place-items-center rounded-full border border-[var(--ctl-border)] bg-[var(--ctl-bg)] text-[var(--text2)] hover:bg-[var(--ctl-hover)]"
                      title={t('createPage.moreOptions')}
                      onClick={(e) => {
                        e.stopPropagation();
                        if (moreMenu) {
                          setMoreMenu(null);
                          return;
                        }
                        const rect = (e.currentTarget as HTMLButtonElement).getBoundingClientRect();
                        const menuW = 224; // w-56
                        const pad = 8;
                        const left = Math.max(pad, Math.min(rect.right - menuW, window.innerWidth - menuW - pad));
                        const top = Math.min(window.innerHeight - pad, rect.bottom + 8);
                        setMoreMenu({ top, left });
                      }}
                      aria-haspopup="menu"
                      aria-expanded={Boolean(moreMenu)}
                    >
                      <HiDotsHorizontal className="h-4 w-4" aria-hidden="true" />
                    </button>

                  </div>
                  {moreMenu ? (
                    <div
                      data-op-more-menu
                      className="fixed z-[60] w-56 overflow-hidden rounded-xl border border-[var(--ctl-border)] bg-[var(--panel-bg)] p-1 shadow-xl"
                      style={{ top: moreMenu.top, left: moreMenu.left }}
                      role="menu"
                      aria-label={t('createPage.moreMenuAriaLabel')}
                      onPointerDown={(e) => e.stopPropagation()}
                    >
                      <div className="px-3 py-2 text-[10px] font-medium tracking-[0.12em] text-[var(--text3)]">
                        {t('createPage.providerSection')}
                      </div>
                      {['internal', 'atlascloud', 'replicate'].map((p) => {
                        const meta = providerMeta[p] || { label: p, Icon: TbCloud };
                        const Icon = meta.Icon;
                        const active = p === provider;
                        return (
                          <button
                            key={p}
                            type="button"
                            role="menuitem"
                            className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
                              active
                                ? 'bg-[var(--surface2)] text-[var(--text)]'
                                : 'text-[var(--text)] hover:bg-[var(--surface2)]'
                            }`}
                            onClick={() => {
                              setMoreMenu(null);
                              selectProvider(p);
                            }}
                          >
                            <span className="inline-flex items-center gap-2">
                              <Icon className="h-4 w-4 text-[var(--text3)]" aria-hidden="true" />
                              <span className="text-sm">{providerLabel(meta.label)}</span>
                            </span>
                            {active ? <span className="text-[12px] text-[var(--amber)]">✓</span> : null}
                          </button>
                        );
                      })}
                    </div>
                  ) : null}
                  </div>
                </div>
              </div>

              {uiState === 'failed' ? (
                <div className="mt-4 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-sm text-red-400">
                  {t('gen.failedPrefix')}
                  {error || t('gen.tryAgain')}
                  {internalConfigHint ? (
                    <div className="mt-3 rounded-lg border border-[var(--border)] bg-[color-mix(in_oklab,var(--bg)_70%,transparent)] p-3 text-[12px] text-[var(--text2)]">
                      <div className="font-semibold text-[var(--text)]">{internalConfigHint.title}</div>
                      <div className="mt-1">{internalConfigHint.body}</div>
                      <ul className="mt-2 list-disc space-y-1 pl-5">
                        {internalConfigHint.steps.map((s) => (
                          <li key={s} className="whitespace-pre-wrap">
                            {s}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null}
                </div>
              ) : null}

              <section className="mt-10">
                <div className="flex items-end justify-between gap-3">
                  <div>
                    <div className="text-sm font-semibold tracking-tight text-[var(--text)]">
                      {t('createPage.popularTitle')}
                    </div>
                    <div className="mt-1 text-xs text-[var(--text2)]">{t('createPage.popularSubtitle')}</div>
                  </div>
                  <a
                    href={`/${locale}`}
                    className="text-xs text-[var(--text3)] hover:text-[var(--amber)]"
                    title={t('createPage.allTemplatesTitle')}
                  >
                    {t('createPage.allTemplatesLink')}
                  </a>
                </div>

                <div className="mt-4 columns-1 gap-4 sm:columns-2">
                  {prompts.slice(0, 50).map((p) => {
                    const src = p.images?.[0];
                    return (
                      <PromptGalleryCard
                        key={p.id}
                        item={p}
                        coverSrc={src}
                        coverSizes="(max-width: 1024px) 100vw, 600px"
                        coverAspectRatio={ratioById[p.id] ?? '4 / 3'}
                        modelBadge={p.model}
                        showModelBadge={false}
                        showDescription={false}
                        showTags={false}
                        showAuthor={false}
                        description={''}
                        tags={[]}
                        aspectTag={null}
                        authorLabel={null}
                        authorUrl={null}
                        coverErrorText={t('gallery.coverLoadFailed')}
                        coverFullscreenTitle={t('createPage.fullscreenTitle')}
                        onCoverFullscreen={
                          p.images?.length
                            ? () =>
                                openViewer(p.images, 0, {
                                  title: p.title,
                                  prefix: p.id,
                                  showDownload: false,
                                })
                            : undefined
                        }
                        onMeta={({ width, height }) => {
                          const ar = `${width} / ${height}`;
                          setRatioById((prev) => (prev[p.id] === ar ? prev : { ...prev, [p.id]: ar }));
                        }}
                        onCardClick={() => {
                          setSelectedId(p.id);
                          const el = document.getElementById('op-create-prompt');
                          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }}
                        onImageClick={() => {
                          setSelectedId(p.id);
                          const el = document.getElementById('op-create-prompt');
                          el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }}
                      />
                    );
                  })}
                </div>
              </section>

              <section className="mt-10">
                <h2 className="text-center text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">{hero.featuresTitle}</h2>
                <div className="mt-4 grid gap-6 md:grid-cols-3">
                  {hero.features.map((f) => (
                    <div key={f.t}>
                      <div className="text-base font-semibold text-[var(--text)]">{f.t}</div>
                      <div className="mt-2 text-sm leading-relaxed text-[var(--text2)]">{f.d}</div>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mt-10">
                <h2 className="text-center text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">{hero.howTitle}</h2>
                <ol className="mt-4 grid gap-3 text-sm text-[var(--text2)]">
                  {hero.howSteps.map((s, i) => (
                    <li key={s} className="flex gap-3">
                      <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--border2)] bg-[var(--surface2)] text-xs text-[var(--text)]">
                        {i + 1}
                      </span>
                      <span className="leading-relaxed">{s}</span>
                    </li>
                  ))}
                </ol>
              </section>

              <section className="mt-10">
                <h2 className="text-center text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">{hero.whyTitle}</h2>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {hero.whyPoints.map((p) => (
                    <div key={p} className="flex gap-2 text-sm text-[var(--text2)]">
                      <span className="mt-1 inline-block h-2 w-2 rounded-full bg-[var(--amber)]" />
                      <span className="leading-relaxed">{p}</span>
                    </div>
                  ))}
                </div>
              </section>

              <section className="mt-10">
                <h2 className="text-center text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">{hero.sayTitle}</h2>
                <div className="mt-4 grid gap-6 md:grid-cols-3">
                  {hero.says.map((x) => (
                    <figure key={x.q} className="text-sm text-[var(--text2)]">
                      <blockquote className="leading-relaxed">“{x.q}”</blockquote>
                      <figcaption className="mt-2 text-xs text-[var(--text3)]">— {x.a}</figcaption>
                    </figure>
                  ))}
                </div>
              </section>

              <section className="mt-10">
                <h2 className="text-center text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">{hero.faqTitle}</h2>
                <div className="mt-4 divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
                  {hero.faqs.map((f) => (
                    <details key={f.q} className="group px-4 py-3">
                      <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--text)]">
                        <div className="flex items-center justify-between gap-3">
                          <span>{f.q}</span>
                          <span className="text-[var(--text3)] group-open:rotate-90 transition">›</span>
                        </div>
                      </summary>
                      <div className="mt-2 text-sm leading-relaxed text-[var(--text2)]">{f.a}</div>
                    </details>
                  ))}
                </div>
              </section>

              <section className="mt-10 rounded-2xl border border-[color-mix(in_oklab,var(--amber)_25%,var(--border))] bg-[color-mix(in_oklab,var(--amber)_10%,transparent)] p-6">
                <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
                  <div>
                    <div className="text-lg font-semibold text-[var(--text)]">{hero.ctaTitle}</div>
                    <div className="mt-1 text-sm text-[var(--text2)]">{hero.ctaSubtitle}</div>
                  </div>
                  <button
                    className="h-10 rounded-full bg-[var(--amber)] px-5 text-sm font-semibold text-[var(--bg)]"
                    onClick={() => {
                      const el = document.getElementById('op-create-prompt');
                      el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                  >
                    {hero.ctaButton}
                  </button>
                </div>
              </section>

            </div>
            </main>

            {/* Right rail */}
            <aside className="relative z-30 hidden min-h-0 flex-col border-l border-[var(--border2)] bg-[color-mix(in_oklab,var(--bg)_70%,var(--surface))] lg:flex shadow-[inset_1px_0_0_rgba(255,255,255,0.04)]">
            <div className="flex items-center justify-between border-b border-[var(--border)] p-4">
              <div className="text-[11px] font-medium tracking-[0.08em] text-[var(--text2)]">
                {t('createPage.resultHistoryLabel')}
              </div>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto p-4">
              {(() => {
                const railCopy = {
                  currentEmpty: t('createPage.railCurrentEmpty'),
                  currentJump: t('createPage.railCurrentJump'),
                  historyEmpty: t('createPage.railHistoryEmpty'),
                  jobIdle: t('createPage.railJobIdle'),
                };

                const emptyHintCard = (body: string, showJump?: boolean) => (
                  <div className="rounded-xl border border-dashed border-[var(--border2)] bg-[var(--surface2)] p-4 text-center">
                    <div className="mx-auto mb-2 grid h-10 w-10 place-items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] text-lg text-[var(--text3)]">
                      ✦
                    </div>
                    <p className="text-[11px] leading-relaxed text-[var(--text3)]">{body}</p>
                    {showJump ? (
                      <button
                        type="button"
                        className="mt-3 text-[11px] font-medium text-[var(--amber)] hover:underline"
                        onClick={() => {
                          document.getElementById('op-create-prompt')?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'center',
                          });
                        }}
                      >
                        {railCopy.currentJump}
                      </button>
                    ) : null}
                  </div>
                );

                return (
                  <>
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
                            {railCopy.jobIdle}
                          </span>
                        )}
                      </div>
                      <div className="mt-2">
                        {uiState === 'queued' || uiState === 'running' ? (
                          <div className="flex flex-col gap-2">
                            {Array.from({ length: Math.max(1, count) }).map((_, i) => (
                              <div key={i} className="h-32 w-full animate-pulse rounded-lg bg-[var(--surface2)]" />
                            ))}
                          </div>
                        ) : images.length ? (
                          <div className="flex flex-col gap-2">
                            {images.map((u, idx) => {
                              const src = proxifyImageUrl(locale, u);
                              return (
                                <div key={`${u}_${idx}`} className="w-full">
                                  <button
                                    type="button"
                                    onClick={() => openViewer(images, idx)}
                                    className="group relative w-full overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface2)] text-left"
                                    title={t('createPage.fullscreenTitle')}
                                    style={{ aspectRatio: ratioByUrl[src] ?? '4 / 3' }}
                                  >
                                    <CoverImage
                                      src={src}
                                      alt=""
                                      sizes="360px"
                                      className="object-contain"
                                      errorText="—"
                                      onMeta={({ width, height }) => {
                                        const ar = `${width} / ${height}`;
                                        setRatioByUrl((prev) => (prev[src] === ar ? prev : { ...prev, [src]: ar }));
                                      }}
                                    />
                                    <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/20" />
                                    <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                                      <button
                                        type="button"
                                        className="grid h-7 w-7 place-items-center rounded-md bg-black/55 text-white/90 hover:bg-black/70"
                                        title={t('createPage.downloadTitle')}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          downloadImageWithRandomName(locale, u).catch(() => {});
                                        }}
                                      >
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                          <path
                                            d="M12 3v10m0 0l4-4m-4 4l-4-4M4 17v3h16v-3"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          />
                                        </svg>
                                      </button>
                                      <span className="grid h-7 w-7 place-items-center rounded-md bg-black/55 text-white/90">
                                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                          <path
                                            d="M9 3H3v6m18 0V3h-6M3 15v6h6m12-6v6h-6"
                                            stroke="currentColor"
                                            strokeWidth="2"
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                          />
                                        </svg>
                                      </span>
                                    </div>
                                  </button>
                                  <div className="mt-1 text-[10px] text-[var(--text3)]">
                                    {idx + 1}/{images.length}
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        ) : uiState === 'failed' ? (
                          emptyHintCard(t('gen.tryAgain'), true)
                        ) : (
                          emptyHintCard(railCopy.currentEmpty, true)
                        )}
                      </div>
                    </div>

                    <div className="mt-4">
                      <div className="mb-2 text-[10px] font-medium tracking-[0.08em] text-[var(--text3)]">
                        {t('createPage.historyLabel')}
                      </div>
                      {history.length ? (
                        <div className="flex flex-col gap-3">
                          {history.map((h) => (
                            <div key={h.id} className="w-full rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                              <div className="flex items-start justify-between gap-3">
                                <button
                                  className="min-w-0 flex-1 text-left"
                                  onClick={() => {
                                    setProvider(h.provider);
                                    setAspectRatio(h.aspectRatio);
                                    setQuality(h.quality);
                                    setCount(h.count);
                                    setModel(h.model);
                                    setPromptText(h.prompt);
                                    setImages(h.images);
                                    setProviderJobId(h.providerJobId);
                                    setUiState(h.images.length ? 'succeeded' : 'idle');
                                  }}
                                  title={new Date(h.createdAt).toLocaleString()}
                                >
                                  <div className="mt-1 line-clamp-2 text-[11px] leading-snug text-[var(--text2)]">
                                    {h.prompt}
                                  </div>
                                  <div className="mt-2 flex flex-wrap gap-1 text-[10px] text-[var(--text3)]">
                                    <span className="rounded-full border border-[var(--border)] bg-[var(--surface2)] px-2 py-0.5">
                                      {h.provider}
                                    </span>
                                    <span className="rounded-full border border-[var(--border)] bg-[var(--surface2)] px-2 py-0.5">
                                      {h.model}
                                    </span>
                                    <span className="rounded-full border border-[var(--border)] bg-[var(--surface2)] px-2 py-0.5">
                                      {h.aspectRatio}
                                    </span>
                                    <span className="rounded-full border border-[var(--border)] bg-[var(--surface2)] px-2 py-0.5">
                                      {h.quality}
                                    </span>
                                    <span className="rounded-full border border-[var(--border)] bg-[var(--surface2)] px-2 py-0.5">
                                      ×{h.count}
                                    </span>
                                  </div>
                                </button>
                                <button
                                  type="button"
                                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[var(--border)] bg-[var(--surface2)] text-[var(--text3)] hover:border-[var(--border2)] hover:text-red-400"
                                  title={t('createPage.deleteTitle')}
                                  onClick={() => setHistory((prev) => prev.filter((x) => x.id !== h.id))}
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

                              {h.images?.length ? (
                                <div className="mt-3 flex flex-col gap-2">
                                  {h.images.map((u, idx) => {
                                    const src = proxifyImageUrl(locale, u);
                                    return (
                                      <div key={`${u}_${idx}`} className="w-full">
                                        <button
                                          type="button"
                                          onClick={() => openViewer(h.images, idx, { prefix: `hist-${h.id}` })}
                                          className="group relative w-full overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface2)] text-left"
                                          title={t('createPage.fullscreenTitle')}
                                          style={{ aspectRatio: ratioByUrl[src] ?? '4 / 3' }}
                                        >
                                          <CoverImage
                                            src={src}
                                            alt=""
                                            sizes="360px"
                                            className="object-contain"
                                            errorText="—"
                                            onMeta={({ width, height }) => {
                                              const ar = `${width} / ${height}`;
                                              setRatioByUrl((prev) => (prev[src] === ar ? prev : { ...prev, [src]: ar }));
                                            }}
                                          />
                                          <div className="absolute inset-0 bg-black/0 transition group-hover:bg-black/20" />
                                          <div className="absolute right-2 top-2 flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
                                            <button
                                              type="button"
                                              className="grid h-7 w-7 place-items-center rounded-md bg-black/55 text-white/90 hover:bg-black/70"
                                              title={t('createPage.downloadTitle')}
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                downloadImageWithRandomName(locale, u).catch(() => {});
                                              }}
                                            >
                                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                                <path
                                                  d="M12 3v10m0 0l4-4m-4 4l-4-4M4 17v3h16v-3"
                                                  stroke="currentColor"
                                                  strokeWidth="2"
                                                  strokeLinecap="round"
                                                  strokeLinejoin="round"
                                                />
                                              </svg>
                                            </button>
                                            <span className="grid h-7 w-7 place-items-center rounded-md bg-black/55 text-white/90">
                                              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                                                <path
                                                  d="M9 3H3v6m18 0V3h-6M3 15v6h6m12-6v6h-6"
                                                  stroke="currentColor"
                                                  strokeWidth="2"
                                                  strokeLinecap="round"
                                                  strokeLinejoin="round"
                                                />
                                              </svg>
                                            </span>
                                          </div>
                                        </button>
                                        <div className="mt-1 text-[10px] text-[var(--text3)]">
                                          {idx + 1}/{h.images.length}
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      ) : (
                        emptyHintCard(railCopy.historyEmpty, true)
                      )}
                    </div>
                  </>
                );
              })()}
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

      {keyDialogOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            setKeyDialogOpen(false);
            setProvider(prevProviderRef.current);
          }}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="border-b border-[var(--border)] p-4">
              <div className="text-sm font-semibold text-[var(--text)]">
                {t('createPage.keyDialogTitle', { provider: keyDialogProvider })}
              </div>
              <div className="mt-1 text-xs text-[var(--text2)]">{t('createPage.keyDialogHint')}</div>
            </div>

            <div className="p-4">
              <input
                autoFocus
                type="password"
                value={keyDraft}
                onChange={(e) => setKeyDraft(e.target.value)}
                placeholder={t('createPage.keyDialogPlaceholder')}
                className="h-10 w-full rounded-xl border border-[var(--border2)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text3)] focus:border-[var(--amber)]"
              />
              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  className="h-9 rounded-xl border border-[var(--border2)] px-4 text-sm text-[var(--text2)] hover:text-[var(--text)]"
                  onClick={() => {
                    setKeyDialogOpen(false);
                    setProvider(prevProviderRef.current);
                  }}
                >
                  {t('createPage.keyDialogCancel')}
                </button>
                <button
                  className="h-9 rounded-xl border border-[var(--border2)] px-4 text-sm text-[var(--text2)] hover:text-[var(--text)]"
                  onClick={() => {
                    clearApiKeyOverride(keyDialogProvider);
                    setKeyDialogOpen(false);
                  }}
                >
                  {t('createPage.keyDialogUseInternal')}
                </button>
                <button
                  className="h-9 rounded-xl bg-[var(--amber)] px-4 text-sm font-semibold text-[var(--bg)]"
                  onClick={() => {
                    saveApiKeyOverride(keyDialogProvider, keyDraft);
                    setKeyDialogOpen(false);
                  }}
                >
                  {t('createPage.keyDialogSave')}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

    </>
  );
}

