'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { submitEditorHref } from '~/lib/prompts/submit-editor-path';
import type { AccountTranslateFn } from './account-actions';
import { loadMyTemplatesStats } from './account-api';

export function StatsPanel({
  active,
  locale,
  t,
  refreshVersion,
  onTemplateCountChange,
  onNavigateTemplates,
}: {
  active: boolean;
  locale: string;
  t: AccountTranslateFn;
  refreshVersion: number;
  onTemplateCountChange: (count: number | null) => void;
  onNavigateTemplates: () => void;
}) {
  const [templateCount, setTemplateCount] = useState<number | null>(null);
  const [pendingCount, setPendingCount] = useState<number | null>(null);

  useEffect(() => {
    if (!active && refreshVersion === 0) return;
    let cancelled = false;

    void (async () => {
      try {
        const stats = await loadMyTemplatesStats(locale);
        if (cancelled) return;
        setTemplateCount(stats.templateCount);
        setPendingCount(stats.pendingCount);
        onTemplateCountChange(stats.templateCount);
      } catch {
        if (cancelled) return;
        setTemplateCount(null);
        setPendingCount(null);
        onTemplateCountChange(null);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [active, locale, onTemplateCountChange, refreshVersion]);

  return (
    <div className={`op-account-panel${active ? ' active' : ''}`}>
      <div className="op-account-metrics">
        <div className="op-account-metric">
          <div className="op-account-metric-label">{t('metrics.templates')}</div>
          <div className="op-account-metric-value">
            {templateCount == null ? '…' : templateCount}
          </div>
        </div>
        <div className="op-account-metric">
          <div className="op-account-metric-label">{t('metrics.pending')}</div>
          <div className="op-account-metric-value">
            {pendingCount == null ? '…' : pendingCount}
          </div>
        </div>
        <div className="op-account-metric">
          <div className="op-account-metric-label">{t('metrics.credits')}</div>
          <div className="op-account-metric-value">—</div>
        </div>
        <div className="op-account-metric">
          <div className="op-account-metric-label">{t('metrics.generations')}</div>
          <div className="op-account-metric-value">—</div>
        </div>
      </div>
      <div className="op-account-card">
        <p className="mb-3 text-sm text-[var(--text2)]">{t('overview.hint')}</p>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="op-account-btn primary" onClick={onNavigateTemplates}>
            {t('overview.manage')}
          </button>
          <Link href={submitEditorHref(locale)} className="op-account-btn">
            {t('overview.submit')}
          </Link>
        </div>
      </div>
    </div>
  );
}