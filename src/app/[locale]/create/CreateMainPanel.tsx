'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { useTranslations } from 'next-intl';
import { PromptGalleryCard } from '~/components/prompt-gallery/PromptGalleryCard';
import type { PromptGalleryItem } from '~/lib/prompts/prompt-model';
import type { CreateHeroBlock } from './types';

type ViewerOptions = {
  title?: string;
  prefix?: string;
  showDownload?: boolean;
};

type Props = {
  locale: string;
  prompts: PromptGalleryItem[];
  hero: CreateHeroBlock;
  carouselItems: PromptGalleryItem[];
  workbench: ReactNode;
  generationError: ReactNode;
  onSelectTemplate(id: string): void;
  onOpenViewer(images: string[], index: number, options?: ViewerOptions): void;
};

function scrollToPrompt() {
  document.getElementById('op-create-prompt')?.scrollIntoView({
    behavior: 'smooth',
    block: 'center',
  });
}

export function CreateMainPanel({
  locale,
  prompts,
  hero,
  carouselItems,
  workbench,
  generationError,
  onSelectTemplate,
  onOpenViewer,
}: Props) {
  const t = useTranslations('OpenPrompts');
  const [carouselIndex, setCarouselIndex] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);
  const [ratioById, setRatioById] = useState<Record<string, string>>({});

  useEffect(() => {
    const mediaQuery = globalThis.window?.matchMedia?.(
      '(prefers-reduced-motion: reduce)',
    );
    if (!mediaQuery) return;
    const applyPreference = () => setReduceMotion(Boolean(mediaQuery.matches));
    applyPreference();
    mediaQuery.addEventListener?.('change', applyPreference);
    return () => mediaQuery.removeEventListener?.('change', applyPreference);
  }, []);

  useEffect(() => {
    if (reduceMotion || carouselItems.length <= 1) return;
    const interval = window.setInterval(() => {
      setCarouselIndex((current) => (current + 1) % carouselItems.length);
    }, 2600);
    return () => window.clearInterval(interval);
  }, [carouselItems.length, reduceMotion]);

  const selectAndScroll = (id: string) => {
    onSelectTemplate(id);
    scrollToPrompt();
  };

  return (
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

            <h1 className="mt-6 text-4xl font-semibold leading-[1.06] tracking-tight text-[var(--text)] sm:text-5xl md:text-6xl">
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
                  const template = carouselItems[carouselIndex];
                  if (template?.id) selectAndScroll(template.id);
                }}
              >
                <span className="shrink-0 rounded-full border border-[color-mix(in_oklab,var(--amber)_25%,transparent)] bg-[color-mix(in_oklab,var(--amber)_12%,transparent)] px-2 py-0.5 text-[10px] font-medium tracking-[0.12em] text-[var(--amber2)]">
                  {t('createPage.carouselPromptBadge')}
                </span>
                <span
                  key={carouselItems[carouselIndex]?.id || carouselIndex}
                  className="truncate"
                >
                  {carouselItems[carouselIndex]?.title || ''}
                </span>
                <span className="shrink-0 text-[var(--text3)] group-hover:text-[var(--amber)]">
                  →
                </span>
              </button>
            </div>
          </div>
        </section>

        {workbench}
        {generationError}

        <section className="mt-10">
          <div className="flex items-end justify-between gap-3">
            <div>
              <div className="text-sm font-semibold tracking-tight text-[var(--text)]">
                {t('createPage.popularTitle')}
              </div>
              <div className="mt-1 text-xs text-[var(--text2)]">
                {t('createPage.popularSubtitle')}
              </div>
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
            {prompts.slice(0, 50).map((template) => (
              <PromptGalleryCard
                key={template.id}
                item={template}
                coverSrc={template.images[0]}
                coverSizes="(max-width: 1024px) 100vw, 600px"
                coverAspectRatio={ratioById[template.id] ?? '4 / 3'}
                modelBadge={template.model}
                showModelBadge={false}
                showDescription={false}
                showTags={false}
                showAuthor={false}
                description=""
                tags={[]}
                aspectTag={null}
                authorLabel={null}
                authorUrl={null}
                coverErrorText={t('gallery.coverLoadFailed')}
                coverFullscreenTitle={t('createPage.fullscreenTitle')}
                onCoverFullscreen={
                  template.images.length
                    ? () =>
                        onOpenViewer(template.images, 0, {
                          title: template.title,
                          prefix: template.id,
                          showDownload: false,
                        })
                    : undefined
                }
                onMeta={({ width, height }) => {
                  const aspectRatio = `${width} / ${height}`;
                  setRatioById((previous) =>
                    previous[template.id] === aspectRatio
                      ? previous
                      : { ...previous, [template.id]: aspectRatio },
                  );
                }}
                onCardClick={() => selectAndScroll(template.id)}
                onImageClick={() => selectAndScroll(template.id)}
              />
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-center text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">
            {hero.featuresTitle}
          </h2>
          <div className="mt-4 grid gap-6 md:grid-cols-3">
            {hero.features.map((feature) => (
              <div key={feature.t}>
                <div className="text-base font-semibold text-[var(--text)]">
                  {feature.t}
                </div>
                <div className="mt-2 text-sm leading-relaxed text-[var(--text2)]">
                  {feature.d}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-center text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">
            {hero.howTitle}
          </h2>
          <ol className="mt-4 grid gap-3 text-sm text-[var(--text2)]">
            {hero.howSteps.map((step, index) => (
              <li key={step} className="flex gap-3">
                <span className="mt-0.5 inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--border2)] bg-[var(--surface2)] text-xs text-[var(--text)]">
                  {index + 1}
                </span>
                <span className="leading-relaxed">{step}</span>
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-10">
          <h2 className="text-center text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">
            {hero.whyTitle}
          </h2>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {hero.whyPoints.map((point) => (
              <div key={point} className="flex gap-2 text-sm text-[var(--text2)]">
                <span className="mt-1 inline-block h-2 w-2 rounded-full bg-[var(--amber)]" />
                <span className="leading-relaxed">{point}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-center text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">
            {hero.sayTitle}
          </h2>
          <div className="mt-4 grid gap-6 md:grid-cols-3">
            {hero.says.map((quote) => (
              <figure key={quote.q} className="text-sm text-[var(--text2)]">
                <blockquote className="leading-relaxed">“{quote.q}”</blockquote>
                <figcaption className="mt-2 text-xs text-[var(--text3)]">
                  — {quote.a}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>

        <section className="mt-10">
          <h2 className="text-center text-xl font-semibold tracking-tight text-[var(--text)] sm:text-2xl">
            {hero.faqTitle}
          </h2>
          <div className="mt-4 divide-y divide-[var(--border)] rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            {hero.faqs.map((faq) => (
              <details key={faq.q} className="group px-4 py-3">
                <summary className="cursor-pointer list-none text-sm font-semibold text-[var(--text)]">
                  <div className="flex items-center justify-between gap-3">
                    <span>{faq.q}</span>
                    <span className="text-[var(--text3)] transition group-open:rotate-90">
                      ›
                    </span>
                  </div>
                </summary>
                <div className="mt-2 text-sm leading-relaxed text-[var(--text2)]">
                  {faq.a}
                </div>
              </details>
            ))}
          </div>
        </section>

        <section className="mt-10 rounded-2xl border border-[color-mix(in_oklab,var(--amber)_25%,var(--border))] bg-[color-mix(in_oklab,var(--amber)_10%,transparent)] p-6">
          <div className="flex flex-col items-start justify-between gap-4 md:flex-row md:items-center">
            <div>
              <div className="text-lg font-semibold text-[var(--text)]">
                {hero.ctaTitle}
              </div>
              <div className="mt-1 text-sm text-[var(--text2)]">
                {hero.ctaSubtitle}
              </div>
            </div>
            <button
              type="button"
              className="h-10 rounded-full bg-[var(--amber)] px-5 text-sm font-semibold text-[var(--bg)]"
              onClick={scrollToPrompt}
            >
              {hero.ctaButton}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}