'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { OpenPromptsSiteHeader } from '~/components/open-prompts/OpenPromptsSiteHeader';
import { MAX_GENERATION_REFERENCE_IMAGE_BYTES } from '~/lib/generation/image-input';
import { aPlusImageUrl, generateAPlusModule, triggerDownload } from './a-plus-api';
import {
  A_PLUS_MODULE_PLAN,
  createInitialAPlusModules,
  isAPlusInputValid,
  normalizeSellingPoints,
  type APlusInput,
  type APlusModuleId,
  type APlusModuleResult,
} from '~/lib/a-plus/a-plus-domain';
import './a-plus.css';

type Props = { locale: string };
type View = 'create' | 'results';

function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const value = typeof reader.result === 'string' ? reader.result : '';
      value ? resolve(value) : reject(new Error('Unable to read product image'));
    };
    reader.onerror = () => reject(reader.error || new Error('Unable to read product image'));
    reader.readAsDataURL(file);
  });
}

const SUPPORTED_SOURCE_IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);

function updateModule(
  modules: APlusModuleResult[],
  id: APlusModuleId,
  update: Partial<APlusModuleResult>,
): APlusModuleResult[] {
  return modules.map((module) => (module.id === id ? { ...module, ...update } : module));
}

export default function PageComponent({ locale }: Props) {
  const t = useTranslations('APlus');
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const sourceReadTokenRef = useRef(0);
  const [view, setView] = useState<View>('create');
  const [productImageUrl, setProductImageUrl] = useState<string | null>(null);
  const [input, setInput] = useState<APlusInput>({
    productName: '',
    category: '',
    sellingPoints: [],
    platform: 'Amazon US',
    language: locale === 'zh' ? '中文' : 'English',
    style: '专业、简洁',
    sourceImageName: null,
    sourceImage: null,
  });
  const [sellingPointsText, setSellingPointsText] = useState('');
  const [modules, setModules] = useState<APlusModuleResult[]>(createInitialAPlusModules);
  const [runStatus, setRunStatus] = useState<'idle' | 'running' | 'succeeded' | 'failed'>('idle');
  const [activeModuleId, setActiveModuleId] = useState<APlusModuleId | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    return () => {
      if (productImageUrl?.startsWith('blob:')) URL.revokeObjectURL(productImageUrl);
    };
  }, [productImageUrl]);

  const validInput = useMemo(
    () => isAPlusInputValid({ ...input, sellingPoints: normalizeSellingPoints(sellingPointsText) }),
    [input, sellingPointsText],
  );

  const setField = useCallback(<K extends keyof APlusInput>(field: K, value: APlusInput[K]) => {
    setInput((current) => ({ ...current, [field]: value }));
  }, []);

  const handleFileChange = async (file: File | undefined) => {
    if (!file) return;
    if (
      !SUPPORTED_SOURCE_IMAGE_TYPES.has(file.type.toLowerCase()) ||
      file.size > MAX_GENERATION_REFERENCE_IMAGE_BYTES
    ) {
      setError(t('errors.invalidImage'));
      setNotice(null);
      return;
    }

    const readToken = ++sourceReadTokenRef.current;
    setError(null);
    if (productImageUrl?.startsWith('blob:')) URL.revokeObjectURL(productImageUrl);
    setProductImageUrl(URL.createObjectURL(file));
    setField('sourceImageName', file.name);
    setField('sourceImage', null);
    setNotice(t('notices.imageReady'));

    try {
      const dataUrl = await readFileAsDataUrl(file);
      if (readToken === sourceReadTokenRef.current) setField('sourceImage', dataUrl);
    } catch (readError: unknown) {
      if (readToken !== sourceReadTokenRef.current) return;
      setError(readError instanceof Error ? readError.message : t('errors.missingFields'));
    }
  };

  const generateModule = useCallback(
    async (moduleId: APlusModuleId, nextInput: APlusInput) => {
      const modulePlan = A_PLUS_MODULE_PLAN.find((item) => item.id === moduleId);
      if (!modulePlan) return false;
      setActiveModuleId(moduleId);
      setModules((current) =>
        updateModule(current, moduleId, {
          status: 'running',
          error: null,
          attempt: (current.find((item) => item.id === moduleId)?.attempt ?? 0) + 1,
        }),
      );

      try {
        const result = await generateAPlusModule({ locale, input: nextInput, module: modulePlan });
        setModules((current) =>
          updateModule(current, moduleId, {
            status: 'succeeded',
            imageUrl: result.imageUrl,
            providerJobId: result.providerJobId,
            error: null,
          }),
        );
        return true;
      } catch (generationError: unknown) {
        const message = generationError instanceof Error ? generationError.message : t('errors.moduleFailed');
        setModules((current) => updateModule(current, moduleId, { status: 'failed', error: message }));
        return false;
      } finally {
        setActiveModuleId(null);
      }
    },
    [locale, t],
  );

  const handleGenerate = async () => {
    const nextInput = { ...input, sellingPoints: normalizeSellingPoints(sellingPointsText) };
    if (!isAPlusInputValid(nextInput)) {
      setError(t('errors.missingFields'));
      return;
    }

    setError(null);
    setNotice(null);
    setView('results');
    setRunStatus('running');
    setModules(createInitialAPlusModules());

    let allSucceeded = true;
    for (const module of A_PLUS_MODULE_PLAN) {
      const succeeded = await generateModule(module.id, nextInput);
      if (!succeeded) allSucceeded = false;
    }
    setRunStatus(allSucceeded ? 'succeeded' : 'failed');
    setNotice(allSucceeded ? t('notices.completed') : t('notices.partial'));
  };

  const handleRerun = async (moduleId: APlusModuleId) => {
    if (activeModuleId) return;
    const nextInput = { ...input, sellingPoints: normalizeSellingPoints(sellingPointsText) };
    setError(null);
    setRunStatus('running');
    const succeeded = await generateModule(moduleId, nextInput);
    setRunStatus(succeeded ? 'succeeded' : 'failed');
    setNotice(succeeded ? t('notices.moduleUpdated') : t('notices.moduleFailed'));
  };

  const handleExportAll = () => {
    const completed = modules.filter((module) => module.imageUrl);
    if (!completed.length) {
      setError(t('errors.noImages'));
      return;
    }
    completed.forEach((module, index) => {
      window.setTimeout(() => {
        const url = aPlusImageUrl(locale, module.imageUrl || '');
        triggerDownload(url, `${module.id}-${input.productName || 'a-plus'}.png`);
      }, index * 160);
    });
    setNotice(t('notices.exported'));
  };

  const statusText = (module: APlusModuleResult) => {
    if (module.status === 'running') return t('status.generating');
    if (module.status === 'succeeded') return t('status.completed');
    if (module.status === 'failed') return t('status.failed');
    return t('status.planned');
  };

  const completedCount = modules.filter((module) => module.status === 'succeeded').length;
  const progress = Math.round((completedCount / modules.length) * 100);

  return (
    <div className="a-plus-app">
      <OpenPromptsSiteHeader
        locale={locale}
        activeNav="aPlus"
        langPathSuffix="/a-plus"
        stickyZClass="z-50"
      />
      <div className="a-plus-content">
        <aside className="a-plus-rail a-plus-left-rail">
          <div className="a-plus-rail-title">{t('rail.sourceTitle')}</div>
          <div className="a-plus-source-card">
            <div className="a-plus-source-image">
              {productImageUrl ? (
                <img src={productImageUrl} alt={input.productName || t('source.alt')} />
              ) : (
                <div className="a-plus-empty-image">✦</div>
              )}
            </div>
            <span className="a-plus-source-name">
              {input.sourceImageName || t('source.empty')}
            </span>
            <span className="a-plus-source-hint">
              <span className="a-plus-dot" /> {productImageUrl ? t('source.ready') : t('source.waiting')}
            </span>
            <button type="button" className="a-plus-quiet-button" onClick={() => fileInputRef.current?.click()}>
              {t('actions.changeImage')}
            </button>
          </div>
          <div className="a-plus-divider" />
          <div className="a-plus-mini-note">
            <strong>{t('rail.autoTitle')}</strong>
            {t('rail.autoBody')}
          </div>
        </aside>

        <main className="a-plus-main">
          <div className="a-plus-main-inner">
            <div className="a-plus-eyebrow"><span className="a-plus-dot" /> {t('eyebrow')}</div>
            <h1>{t('title')} <em>{t('titleEm')}</em></h1>
            <p className="a-plus-intro">{t('intro')}</p>

            <div className="a-plus-tabs" role="tablist" aria-label={t('tabs.label')}>
              <button type="button" role="tab" aria-selected={view === 'create'} className={view === 'create' ? 'active' : ''} onClick={() => setView('create')}>
                {t('tabs.create')}
              </button>
              <button type="button" role="tab" aria-selected={view === 'results'} className={view === 'results' ? 'active' : ''} onClick={() => setView('results')}>
                {t('tabs.results')} {completedCount > 0 ? `· ${completedCount}` : ''}
              </button>
            </div>

            {view === 'create' ? (
              <section className="a-plus-view" aria-labelledby="a-plus-create-title">
                <div className="a-plus-card">
                  <div className="a-plus-card-head">
                    <div>
                      <h2 id="a-plus-create-title">{t('create.title')}</h2>
                      <p>{t('create.subtitle')}</p>
                    </div>
                    <span className="a-plus-tag a-plus-tag-green">{t('create.badge')}</span>
                  </div>
                  <div className="a-plus-card-body">
                    <div className="a-plus-upload-row">
                      <div className="a-plus-upload-preview">
                        {productImageUrl ? <img src={productImageUrl} alt={t('source.alt')} /> : <span>✦</span>}
                      </div>
                      <div className="a-plus-upload-copy">
                        <strong>{t('upload.title')}</strong>
                        <p>{t('upload.description')}</p>
                        <button type="button" onClick={() => fileInputRef.current?.click()}>{t('actions.selectImage')}</button>
                        <input ref={fileInputRef} type="file" accept="image/*" hidden onChange={(event) => handleFileChange(event.target.files?.[0])} />
                      </div>
                    </div>
                    <div className="a-plus-field-grid">
                      <label className="a-plus-field">
                        <span>{t('fields.productName')}</span>
                        <input value={input.productName} onChange={(event) => setField('productName', event.target.value)} placeholder={t('fields.productNamePlaceholder')} />
                      </label>
                      <label className="a-plus-field">
                        <span>{t('fields.category')}</span>
                        <input value={input.category} onChange={(event) => setField('category', event.target.value)} placeholder={t('fields.categoryPlaceholder')} />
                      </label>
                      <label className="a-plus-field a-plus-field-full">
                        <span>{t('fields.sellingPoints')}</span>
                        <textarea value={sellingPointsText} onChange={(event) => setSellingPointsText(event.target.value)} placeholder={t('fields.sellingPointsPlaceholder')} />
                        <small>{t('fields.sellingPointsHint')}</small>
                      </label>
                      <label className="a-plus-field">
                        <span>{t('fields.platform')}</span>
                        <select value={input.platform} onChange={(event) => setField('platform', event.target.value)}>
                          <option>Amazon US</option>
                          <option>{t('options.genericCommerce')}</option>
                        </select>
                      </label>
                      <label className="a-plus-field">
                        <span>{t('fields.language')}</span>
                        <select value={input.language} onChange={(event) => setField('language', event.target.value)}>
                          <option>English</option>
                          <option>中文</option>
                        </select>
                      </label>
                    </div>
                    <div className="a-plus-form-actions">
                      <span className="a-plus-muted">{t('create.footerHint')}</span>
                      <button type="button" className="a-plus-button a-plus-button-primary" disabled={!validInput || runStatus === 'running'} onClick={() => void handleGenerate()}>
                        {runStatus === 'running' ? t('actions.generating') : t('actions.generate')}
                        <span aria-hidden="true">→</span>
                      </button>
                    </div>
                    {error ? <div className="a-plus-error">{error}</div> : null}
                  </div>
                </div>
              </section>
            ) : (
              <section className="a-plus-view" aria-labelledby="a-plus-results-title">
                <div className="a-plus-results-head">
                  <div>
                    <h2 id="a-plus-results-title">{runStatus === 'running' ? t('results.generatingTitle') : t('results.title')}</h2>
                    <p>{runStatus === 'running' ? t('results.generatingBody') : t('results.body')}</p>
                  </div>
                  <button type="button" className="a-plus-button" onClick={handleExportAll} disabled={!completedCount}>{t('actions.exportAll')}</button>
                </div>
                <div className="a-plus-progress-card">
                  <div className="a-plus-progress-top"><span>{runStatus === 'running' ? t('status.generating') : runStatus === 'failed' ? t('status.partial') : t('status.completed')}</span><strong>{progress}%</strong></div>
                  <div className="a-plus-progress-track"><span style={{ width: `${progress}%` }} /></div>
                  <p>{t('results.automationHint')}</p>
                </div>
                <div className="a-plus-result-grid">
                  {modules.map((module) => {
                    const proxiedUrl = module.imageUrl ? aPlusImageUrl(locale, module.imageUrl) : null;
                    return (
                      <article key={module.id} className={`a-plus-result-card ${activeModuleId === module.id ? 'selected' : ''}`}>
                        <div className="a-plus-result-image">
                          {proxiedUrl ? <img src={proxiedUrl} alt={t(module.titleKey as any)} /> : <div className="a-plus-result-placeholder"><span>{module.id}</span><small>{activeModuleId === module.id ? t('status.generating') : t('results.pendingImage')}</small></div>}
                          <span className={`a-plus-status a-plus-status-${module.status}`}><span className="a-plus-dot" />{statusText(module)}</span>
                        </div>
                        <div className="a-plus-result-copy">
                          <div className="a-plus-result-label"><span>{module.id}</span><strong>{t(module.titleKey as any)}</strong></div>
                          <p>{t(module.roleKey as any)}</p>
                          {module.error ? <div className="a-plus-module-error">{module.error}</div> : null}
                          <div className="a-plus-result-actions">
                            <button type="button" className="a-plus-button a-plus-button-small" disabled={Boolean(activeModuleId)} onClick={() => void handleRerun(module.id)}>{t('actions.rerun')}</button>
                            {proxiedUrl ? <button type="button" className="a-plus-button a-plus-button-small a-plus-button-quiet" onClick={() => triggerDownload(proxiedUrl, `${module.id}-${input.productName || 'a-plus'}.png`)}>{t('actions.download')}</button> : null}
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
                <button type="button" className="a-plus-back-button" onClick={() => setView('create')}>← {t('actions.back')}</button>
              </section>
            )}

            {notice ? <div className="a-plus-notice">{notice}</div> : null}
          </div>
        </main>

        <aside className="a-plus-rail a-plus-right-rail">
          <div className="a-plus-rail-title">{t('rail.planTitle')} <span>{completedCount}/{modules.length}</span></div>
          <div className="a-plus-plan-list">
            {modules.map((module) => (
              <button key={module.id} type="button" className={`a-plus-plan-card ${activeModuleId === module.id ? 'selected' : ''}`} onClick={() => setView('results')}>
                <span className="a-plus-plan-number">{module.id}</span>
                <span className="a-plus-plan-copy"><strong>{t(module.titleKey as any)}</strong><span>{t(module.roleKey as any)}</span></span>
                <span className="a-plus-plan-arrow">›</span>
              </button>
            ))}
          </div>
          <div className="a-plus-plan-tip">{t('rail.planTip')}</div>
        </aside>
      </div>
    </div>
  );
}