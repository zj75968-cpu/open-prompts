'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { FaCubes } from 'react-icons/fa';
import { HiDotsHorizontal } from 'react-icons/hi';
import {
  LuCheck,
  LuChevronDown,
  LuHash,
  LuLayers,
  LuShield,
} from 'react-icons/lu';
import { TbCloud } from 'react-icons/tb';
import type { ProviderCapabilities } from '~/lib/generation/capabilities';

type Popover = 'model' | 'ratio' | 'quality' | 'count';

type Props = {
  provider: string;
  model: string;
  fallbackModel?: string;
  modelOptions: { label: string; value?: string }[];
  aspectRatio: string;
  quality: string;
  count: number;
  capabilities: ProviderCapabilities;
  canGenerate: boolean;
  generating: boolean;
  onProviderChange(provider: string): void;
  onModelChange(model: string): void;
  onAspectRatioChange(aspectRatio: string): void;
  onQualityChange(quality: string): void;
  onCountChange(count: number): void;
  onGenerate(): void;
  getApiKeyOverride(provider: string): string;
  saveApiKeyOverride(provider: string, value: string): void;
  clearApiKeyOverride(provider: string): void;
};

const PROVIDERS = [
  { name: 'internal', Icon: LuShield },
  { name: 'atlascloud', Icon: TbCloud },
  { name: 'replicate', Icon: FaCubes },
];

function RatioGlyph({ aspectRatio }: { aspectRatio: string }) {
  const [rawWidth, rawHeight] = String(aspectRatio || '').trim().split(':');
  const width = Number(rawWidth);
  const height = Number(rawHeight);
  const ratio = width > 0 && height > 0 ? width / height : 1;
  const max = 14;
  const glyphWidth = ratio >= 1 ? max : Math.max(6, Math.round(max * ratio));
  const glyphHeight = ratio >= 1 ? Math.max(6, Math.round(max / ratio)) : max;

  return (
    <span className="grid h-5 w-5 place-items-center rounded-md border border-[var(--border)] bg-[var(--surface2)]">
      <span
        className="block rounded-[3px] border border-[var(--border2)] bg-[color-mix(in_oklab,var(--surface)_70%,transparent)]"
        style={{ width: `${glyphWidth}px`, height: `${glyphHeight}px` }}
      />
    </span>
  );
}

export function ModelSettings({
  provider,
  model,
  fallbackModel,
  modelOptions,
  aspectRatio,
  quality,
  count,
  capabilities,
  canGenerate,
  generating,
  onProviderChange,
  onModelChange,
  onAspectRatioChange,
  onQualityChange,
  onCountChange,
  onGenerate,
  getApiKeyOverride,
  saveApiKeyOverride,
  clearApiKeyOverride,
}: Props) {
  const t = useTranslations('OpenPrompts');
  const previousProviderRef = useRef(provider);
  const moreButtonWrapRef = useRef<HTMLDivElement | null>(null);
  const [openPopover, setOpenPopover] = useState<Popover | null>(null);
  const [moreMenu, setMoreMenu] = useState<{ top: number; left: number } | null>(
    null,
  );
  const [keyDialogProvider, setKeyDialogProvider] = useState<string | null>(null);
  const [keyDraft, setKeyDraft] = useState('');

  useEffect(() => {
    const closeMenus = (event: PointerEvent) => {
      const target = event.target as HTMLElement | null;
      if (!target) return;

      if (
        !moreButtonWrapRef.current?.contains(target) &&
        !target.closest('[data-op-more-menu]')
      ) {
        setMoreMenu(null);
      }
      if (!target.closest('[data-op-popover]')) setOpenPopover(null);
    };

    document.addEventListener('pointerdown', closeMenus);
    return () => document.removeEventListener('pointerdown', closeMenus);
  }, []);

  const providerLabel = (name: string) =>
    name === 'internal' ? t('createPage.providerInternal') : name;

  const selectProvider = (nextProvider: string) => {
    if (nextProvider === provider) return;
    if (nextProvider === 'internal') {
      setKeyDialogProvider(null);
      onProviderChange(nextProvider);
      return;
    }

    previousProviderRef.current = provider;
    onProviderChange(nextProvider);
    setKeyDraft(getApiKeyOverride(nextProvider));
    setKeyDialogProvider(nextProvider);
  };

  const closeKeyDialog = () => {
    setKeyDialogProvider(null);
    onProviderChange(previousProviderRef.current);
  };

  const ratioLabel = (value: string) => {
    if (value === '1:1') return t('createPage.ratioSquare', { ratio: value });
    if (value === '2:1') return t('createPage.ratioUltraWide', { ratio: value });
    if (['16:9', '4:3', '3:2', '5:4'].includes(value)) {
      return t('createPage.ratioLandscape', { ratio: value });
    }
    if (['9:16', '3:4', '2:3', '4:5'].includes(value)) {
      return t('createPage.ratioPortrait', { ratio: value });
    }
    return value;
  };

  return (
    <>
      <div className="p-3">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative" data-op-popover>
            <button
              type="button"
              className="inline-flex h-9 items-center gap-2 rounded-full border border-[var(--ctl-border)] bg-[var(--ctl-bg)] px-3 text-[12px] text-[var(--text2)] hover:bg-[var(--ctl-hover)]"
              onClick={() =>
                setOpenPopover((current) =>
                  current === 'model' ? null : 'model',
                )
              }
              title={t('createPage.modelTitle')}
            >
              <span className="grid h-5 w-5 place-items-center rounded-md bg-[color-mix(in_oklab,var(--ctl-bg)_70%,transparent)] text-[var(--text3)]">
                ✦
              </span>
              <span className="max-w-[180px] truncate text-[var(--text)]">
                {modelOptions.find(
                  (option) => String(option.value ?? option.label) === model,
                )?.label ||
                  modelOptions[0]?.label ||
                  model ||
                  fallbackModel ||
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
                  {modelOptions.map((option) => {
                    const value = String(option.value ?? option.label);
                    const active = value === model;
                    return (
                      <button
                        key={value}
                        type="button"
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm ${
                          active
                            ? 'bg-[var(--surface2)] text-[var(--text)]'
                            : 'text-[var(--text)] hover:bg-[var(--surface2)]'
                        }`}
                        onClick={() => {
                          onModelChange(value);
                          setOpenPopover(null);
                        }}
                      >
                        <span className="truncate">{option.label}</span>
                        {active ? (
                          <LuCheck className="h-4 w-4 text-[var(--amber)]" aria-hidden="true" />
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
              onClick={() =>
                setOpenPopover((current) =>
                  current === 'ratio' ? null : 'ratio',
                )
              }
              title={t('gen.aspectRatio')}
            >
              <RatioGlyph aspectRatio={aspectRatio} />
              <span className="text-[var(--text)]">{aspectRatio}</span>
              <LuChevronDown className="h-4 w-4 text-[var(--text3)]" aria-hidden="true" />
            </button>
            {openPopover === 'ratio' ? (
              <div className="absolute left-1/2 z-20 mt-2 w-72 -translate-x-1/2 overflow-hidden rounded-xl border border-[var(--ctl-border)] bg-[var(--panel-bg)] shadow-xl">
                <div className="border-b border-[var(--border)] px-4 py-3 text-xs font-medium text-[var(--text2)]">
                  {t('createPage.selectImageRatio')}
                </div>
                <div className="max-h-[320px] overflow-y-auto p-1">
                  {capabilities.aspectRatios.map((value) => {
                    const active = value === aspectRatio;
                    return (
                      <button
                        key={value}
                        type="button"
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm ${
                          active
                            ? 'bg-[var(--surface2)] text-[var(--text)]'
                            : 'text-[var(--text)] hover:bg-[var(--surface2)]'
                        }`}
                        onClick={() => {
                          onAspectRatioChange(value);
                          setOpenPopover(null);
                        }}
                      >
                        <span className="inline-flex items-center gap-2">
                          <RatioGlyph aspectRatio={value} />
                          <span>{ratioLabel(value)}</span>
                        </span>
                        {active ? (
                          <LuCheck className="h-4 w-4 text-[var(--amber)]" aria-hidden="true" />
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
              onClick={() =>
                setOpenPopover((current) =>
                  current === 'quality' ? null : 'quality',
                )
              }
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
                  {capabilities.qualities.map((value) => {
                    const active = value === quality;
                    return (
                      <button
                        key={value}
                        type="button"
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm ${
                          active
                            ? 'bg-[var(--surface2)] text-[var(--text)]'
                            : 'text-[var(--text)] hover:bg-[var(--surface2)]'
                        }`}
                        onClick={() => {
                          onQualityChange(value);
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
                            {value}
                            {value === '1k'
                              ? t('createPage.qualityDefaultSuffix')
                              : ''}
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
              onClick={() =>
                setOpenPopover((current) =>
                  current === 'count' ? null : 'count',
                )
              }
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
                  {Array.from(
                    { length: capabilities.maxCount },
                    (_, index) => index + 1,
                  ).map((value) => {
                    const active = value === count;
                    return (
                      <button
                        key={value}
                        type="button"
                        className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm ${
                          active
                            ? 'bg-[var(--surface2)] text-[var(--text)]'
                            : 'text-[var(--text)] hover:bg-[var(--surface2)]'
                        }`}
                        onClick={() => {
                          onCountChange(value);
                          setOpenPopover(null);
                        }}
                      >
                        <span>{value}</span>
                        {active ? (
                          <LuCheck className="h-4 w-4 text-[var(--amber)]" aria-hidden="true" />
                        ) : null}
                      </button>
                    );
                  })}
                </div>
              </div>
            ) : null}
          </div>

          <button
            type="button"
            disabled={!canGenerate}
            onClick={onGenerate}
            className="ml-auto h-9 rounded-full bg-[var(--amber)] px-5 text-[12px] font-semibold text-[var(--bg)] disabled:opacity-50"
          >
            {generating ? t('gen.generating') : t('gen.generate')}
          </button>

          <div className="relative" ref={moreButtonWrapRef}>
            <button
              type="button"
              className="grid h-9 w-9 place-items-center rounded-full border border-[var(--ctl-border)] bg-[var(--ctl-bg)] text-[var(--text2)] hover:bg-[var(--ctl-hover)]"
              title={t('createPage.moreOptions')}
              onClick={(event) => {
                event.stopPropagation();
                if (moreMenu) {
                  setMoreMenu(null);
                  return;
                }
                const rect = event.currentTarget.getBoundingClientRect();
                const menuWidth = 224;
                const padding = 8;
                setMoreMenu({
                  top: Math.min(window.innerHeight - padding, rect.bottom + 8),
                  left: Math.max(
                    padding,
                    Math.min(
                      rect.right - menuWidth,
                      window.innerWidth - menuWidth - padding,
                    ),
                  ),
                });
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
              onPointerDown={(event) => event.stopPropagation()}
            >
              <div className="px-3 py-2 text-[10px] font-medium tracking-[0.12em] text-[var(--text3)]">
                {t('createPage.providerSection')}
              </div>
              {PROVIDERS.map(({ name, Icon }) => {
                const active = name === provider;
                return (
                  <button
                    key={name}
                    type="button"
                    role="menuitem"
                    className={`flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm transition ${
                      active
                        ? 'bg-[var(--surface2)] text-[var(--text)]'
                        : 'text-[var(--text)] hover:bg-[var(--surface2)]'
                    }`}
                    onClick={() => {
                      setMoreMenu(null);
                      selectProvider(name);
                    }}
                  >
                    <span className="inline-flex items-center gap-2">
                      <Icon className="h-4 w-4 text-[var(--text3)]" aria-hidden="true" />
                      <span className="text-sm">{providerLabel(name)}</span>
                    </span>
                    {active ? (
                      <span className="text-[12px] text-[var(--amber)]">✓</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>

      {keyDialogProvider ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4"
          role="dialog"
          aria-modal="true"
          onClick={closeKeyDialog}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="border-b border-[var(--border)] p-4">
              <div className="text-sm font-semibold text-[var(--text)]">
                {t('createPage.keyDialogTitle', {
                  provider: keyDialogProvider,
                })}
              </div>
              <div className="mt-1 text-xs text-[var(--text2)]">
                {t('createPage.keyDialogHint')}
              </div>
            </div>
            <div className="p-4">
              <input
                autoFocus
                type="password"
                value={keyDraft}
                onChange={(event) => setKeyDraft(event.target.value)}
                placeholder={t('createPage.keyDialogPlaceholder')}
                className="h-10 w-full rounded-xl border border-[var(--border2)] bg-[var(--surface)] px-3 text-sm text-[var(--text)] outline-none placeholder:text-[var(--text3)] focus:border-[var(--amber)]"
              />
              <div className="mt-4 flex items-center justify-end gap-2">
                <button
                  type="button"
                  className="h-9 rounded-xl border border-[var(--border2)] px-4 text-sm text-[var(--text2)] hover:text-[var(--text)]"
                  onClick={closeKeyDialog}
                >
                  {t('createPage.keyDialogCancel')}
                </button>
                <button
                  type="button"
                  className="h-9 rounded-xl border border-[var(--border2)] px-4 text-sm text-[var(--text2)] hover:text-[var(--text)]"
                  onClick={() => {
                    clearApiKeyOverride(keyDialogProvider);
                    setKeyDialogProvider(null);
                  }}
                >
                  {t('createPage.keyDialogUseInternal')}
                </button>
                <button
                  type="button"
                  className="h-9 rounded-xl bg-[var(--amber)] px-4 text-sm font-semibold text-[var(--bg)]"
                  onClick={() => {
                    saveApiKeyOverride(keyDialogProvider, keyDraft);
                    setKeyDialogProvider(null);
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