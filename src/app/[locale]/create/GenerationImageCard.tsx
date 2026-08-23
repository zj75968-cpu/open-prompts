'use client';

import { useTranslations } from 'next-intl';
import { CoverImage } from '~/components/prompt-gallery/CoverImage';
import { fetchImageBlob } from './create-api';

function randomImageName(blob: Blob) {
  const bytes = new Uint8Array(10);
  globalThis.crypto?.getRandomValues?.(bytes);
  const token = Array.from(bytes)
    .map((value) => value.toString(16).padStart(2, '0'))
    .join('') || Math.random().toString(16).slice(2);
  const extension = blob.type.includes('png')
    ? 'png'
    : blob.type.includes('jpeg') || blob.type.includes('jpg')
      ? 'jpg'
      : blob.type.includes('webp')
        ? 'webp'
        : 'img';
  return `open-prompts-${token}.${extension}`;
}

type Props = {
  locale: string;
  sourceUrl: string;
  displayUrl: string;
  aspectRatio: string;
  positionLabel: string;
  onOpen(): void;
  onAspectRatio(aspectRatio: string): void;
};

export function GenerationImageCard({
  locale,
  sourceUrl,
  displayUrl,
  aspectRatio,
  positionLabel,
  onOpen,
  onAspectRatio,
}: Props) {
  const t = useTranslations('OpenPrompts');

  const downloadImage = async () => {
    const blob = await fetchImageBlob(locale, sourceUrl);
    const objectUrl = URL.createObjectURL(blob);
    try {
      const anchor = document.createElement('a');
      anchor.href = objectUrl;
      anchor.download = randomImageName(blob);
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
    } finally {
      URL.revokeObjectURL(objectUrl);
    }
  };

  return (
    <div className="w-full">
      <div
        className="group relative w-full overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface2)]"
        style={{ aspectRatio }}
      >
        <button
          type="button"
          onClick={onOpen}
          className="absolute inset-0 z-[1] w-full text-left"
          title={t('createPage.fullscreenTitle')}
          aria-label={t('createPage.fullscreenTitle')}
        />
        <CoverImage
          src={displayUrl}
          alt=""
          sizes="360px"
          className="object-contain"
          errorText="—"
          onMeta={({ width, height }) => onAspectRatio(`${width} / ${height}`)}
        />
        <div className="pointer-events-none absolute inset-0 bg-black/0 transition group-hover:bg-black/20" />
        <div className="absolute right-2 top-2 z-[2] flex items-center gap-1 opacity-0 transition group-hover:opacity-100">
          <button
            type="button"
            className="grid h-7 w-7 place-items-center rounded-md bg-black/55 text-white/90 hover:bg-black/70"
            title={t('createPage.downloadTitle')}
            onClick={() => {
              downloadImage().catch(() => {});
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
      </div>
      <div className="mt-1 text-[10px] text-[var(--text3)]">{positionLabel}</div>
    </div>
  );
}