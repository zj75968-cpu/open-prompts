'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { uploadImageAsset } from '~/lib/assets/asset-api-client';
import { MAX_RESULT_IMAGES } from './submit-types';
import { isValidImageSrc } from './submit-utils';

export type AssetEditorProps = {
  images: string[];
  imagesFull: boolean;
  onAppendImages: (images: string[]) => void;
  onAddImage: (url: string) => void;
  onRemoveImage: (index: number) => void;
};

export function AssetEditor({
  images,
  imagesFull,
  onAppendImages,
  onAddImage,
  onRemoveImage,
}: AssetEditorProps) {
  const t = useTranslations('OpenPrompts.submitPage');
  const [urlDraft, setUrlDraft] = useState('');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadingCount, setUploadingCount] = useState(0);
  const [uploadDrag, setUploadDrag] = useState(false);

  const handleFiles = (files: FileList | null) => {
    if (!files?.length || uploadingCount > 0) return;
    const room = Math.max(0, MAX_RESULT_IMAGES - images.length);
    const selected = Array.from(files).slice(0, room);
    if (!selected.length) return;

    setUploadError(null);
    setUploadingCount(selected.length);
    void (async () => {
      const uploadedUrls: string[] = [];
      for (const file of selected) {
        try {
          // Keep uploads sequential to bound Worker and browser memory usage.
          // eslint-disable-next-line no-await-in-loop
          const asset = await uploadImageAsset(file);
          uploadedUrls.push(asset.url);
        } catch (error: unknown) {
          setUploadError(error instanceof Error ? error.message : 'Image upload failed.');
          break;
        }
      }
      setUploadingCount(0);
      if (uploadedUrls.length > 0) onAppendImages(uploadedUrls);
    })();
    setUploadDrag(false);
  };

  const uploadDisabled = imagesFull || uploadingCount > 0;

  const addImageUrl = () => {
    const raw = urlDraft.trim();
    if (!raw) return;
    if (imagesFull) {
      setUrlError(t('validation.imageLimit'));
      return;
    }
    if (!isValidImageSrc(raw)) {
      setUrlError(t('validation.invalidImageUrl'));
      return;
    }
    if (images.includes(raw)) {
      setUrlError(t('validation.duplicateImageUrl'));
      return;
    }
    onAddImage(raw);
    setUrlDraft('');
    setUrlError(null);
  };

  return (
    <section aria-labelledby="asset-editor-title">
      <div id="asset-editor-title" className="op-sp-divider">
        {t('guidelines.dividerImages')}
      </div>

      <div className="op-sp-form-group">
        <div className="mb-2 flex items-baseline justify-between gap-2">
          <label className="op-sp-label !mb-0">
            {t('labels.upload')}
            <span className="op-hint">{t('hints.upload')}</span>
          </label>
          <span className="shrink-0 font-mono text-[10px] text-[var(--text3)]">
            {t('hints.imageCount', { count: images.length, max: MAX_RESULT_IMAGES })}
          </span>
        </div>
        <div
          id="upload-zone"
          className={`op-sp-upload${uploadDrag ? ' op-drag' : ''}${uploadDisabled ? ' op-sp-upload--full' : ''}`}
          onDragOver={(event) => {
            if (uploadDisabled) return;
            event.preventDefault();
            setUploadDrag(true);
          }}
          onDragLeave={() => setUploadDrag(false)}
          onDrop={(event) => {
            event.preventDefault();
            setUploadDrag(false);
            handleFiles(event.dataTransfer.files);
          }}
        >
          <input
            type="file"
            accept="image/*"
            multiple
            disabled={uploadDisabled}
            onChange={(event) => {
              handleFiles(event.target.files);
              event.target.value = '';
            }}
          />
          <div className="text-sm font-medium text-[var(--text)]">
            {uploadingCount > 0 ? '…' : imagesFull ? '✓' : '↑'}
          </div>
          <div className="mt-1 text-xs text-[var(--text3)]">
            {uploadingCount > 0
              ? `${uploadingCount} image${uploadingCount === 1 ? '' : 's'} uploading…`
              : imagesFull
                ? t('hints.uploadFull')
                : t('hints.upload')}
          </div>
        </div>
        {uploadError ? <p className="mt-1.5 text-xs text-[var(--coral)]">{uploadError}</p> : null}

        <div className="mt-4">
          <label className="op-sp-label" htmlFor="f-img-url">
            {t('labels.imageUrls')}
            <span className="op-hint">{t('hints.urls')}</span>
          </label>
          <div className="op-sp-source-row">
            <input
              id="f-img-url"
              className="op-sp-input"
              value={urlDraft}
              disabled={imagesFull}
              onChange={(event) => {
                setUrlDraft(event.target.value);
                setUrlError(null);
              }}
              onKeyDown={(event) => {
                if (event.key !== 'Enter') return;
                event.preventDefault();
                addImageUrl();
              }}
              placeholder={t('placeholders.urls')}
            />
            <button
              type="button"
              className="op-sp-btn-next shrink-0 px-4 py-2 text-xs"
              disabled={imagesFull || !urlDraft.trim()}
              onClick={addImageUrl}
            >
              {t('buttons.addUrl')}
            </button>
          </div>
          {urlError ? <p className="mt-1.5 text-xs text-[var(--coral)]">{urlError}</p> : null}
        </div>

        {images.length > 0 ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {images.map((src, index) => (
              <div
                key={`${index}-${src.slice(0, 32)}`}
                className="relative h-16 w-[5.5rem] overflow-hidden rounded-md border border-[var(--border2)] bg-[var(--surface2)]"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={src} alt="" className="h-full w-full object-cover" />
                <button
                  type="button"
                  className="absolute right-0.5 top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-black/70 text-[10px] text-white hover:bg-black/90"
                  aria-label={t('buttons.removeImage')}
                  onClick={() => onRemoveImage(index)}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}