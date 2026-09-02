'use client';

import { useEffect, useState } from 'react';
import type {
  AdminTemplateRecord,
  AdminTemplateSummary,
} from '~/lib/prompts/template-types';
import type { AdminUserTrendRange } from '~/lib/users/admin-user-trend';
import type { AccountTranslateFn } from './account-actions';
import { loadAdminTemplateDetail } from './account-api';
import { AccountDailyTrend, AccountPagination } from './account-list-components';
import {
  AccountTemplateDetailDialog,
  useAccountTemplateDetail,
} from './account-template-detail';
import { AccountTemplateTable } from './AccountTemplateTable';
import {
  useAdminTemplatesContent,
  type InitialAdminTemplates,
} from './use-admin-templates-content';

export function AdminTemplatesPanel({
  active,
  locale,
  isAdmin,
  userEmail,
  t,
  initialAdmin,
  refreshOverview,
  onPendingCountChange,
}: {
  active: boolean;
  locale: string;
  isAdmin: boolean;
  userEmail: string;
  t: AccountTranslateFn;
  initialAdmin?: InitialAdminTemplates | null;
  refreshOverview: () => void;
  onPendingCountChange: (count: number | null) => void;
}) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [trendDays, setTrendDays] = useState<AdminUserTrendRange>(30);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const detail = useAccountTemplateDetail(t);

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [search, statusFilter, pageSize, trendDays]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [page]);

  useEffect(() => {
    if (!active) detail.closeDetail();
  }, [active, detail.closeDetail]);

  const content = useAdminTemplatesContent({
    locale,
    isAdmin,
    active,
    userEmail,
    t,
    initial: initialAdmin,
    query: { search, statusFilter, page, pageSize, trendDays },
    selection: { selectedIds, setSelectedIds },
    refreshOverview,
    onPendingCountChange,
  });

  const toggleSelection = (id: number) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = (pageIds: number[]) => {
    const allSelected = pageIds.length > 0 && pageIds.every((id) => selectedIds.has(id));
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const id of pageIds) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
  };

  const openAdminDetail = async (summary: AdminTemplateSummary) => {
    const item = await loadAdminTemplateDetail(locale, summary.id);
    if (!item) return;
    const source: AdminTemplateRecord = {
      ...item,
      submitterEmail: summary.submitterEmail,
    };
    detail.openDetail(source, true);
  };

  return (
    <div className={`op-account-panel${active ? ' active' : ''}`}>
      <p className="mb-3 text-sm text-[var(--text2)]">{t('admin.hint')}</p>
      <p className="mb-3 text-xs text-[var(--text3)]">{t('admin.hintActions')}</p>
      {content.adminLoadError ? (
        <p className="mb-3 text-sm text-[var(--coral)]">
          {t('admin.loadError', { message: content.adminLoadError })}
        </p>
      ) : null}

      <AccountDailyTrend
        locale={locale}
        t={t}
        points={content.adminPromptsDailyTrend}
        loading={content.adminLoading}
        trendDays={trendDays}
        setTrendDays={setTrendDays}
        hintKey="admin.trendDaysHint"
        titleKey="admin.trendPromptsTitle"
      />

      <div className="op-account-toolbar">
        <input
          className="op-account-search"
          placeholder={t('toolbar.search')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void content.loadAdminTemplates();
          }}
        />
        <select
          className="op-account-select"
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="">{t('toolbar.allStatus')}</option>
          <option value="pending">{t('status.pending')}</option>
          <option value="approved">{t('status.pub')}</option>
          <option value="rejected">{t('status.rejected')}</option>
        </select>
        <button
          type="button"
          className="op-account-btn"
          onClick={() => void content.loadAdminTemplates()}
        >
          {t('toolbar.refresh')}
        </button>
      </div>

      <AccountPagination
        t={t}
        page={page}
        setPage={setPage}
        pageSize={pageSize}
        setPageSize={setPageSize}
        total={content.adminTotal}
        hasMore={content.adminHasMore}
        loading={content.adminLoading}
      />

      {selectedIds.size > 0 ? (
        <div className="op-account-bulk-bar">
          <span className="text-xs text-[var(--text2)]">
            {t('admin.selectedCount', { count: selectedIds.size })}
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="op-account-btn primary"
              disabled={content.bulkReviewBusy}
              onClick={() => void content.bulkReview('approved')}
            >
              {t('admin.approveSelected')}
            </button>
            <button
              type="button"
              className="op-account-btn reject"
              disabled={content.bulkReviewBusy}
              onClick={() => void content.bulkReview('rejected')}
            >
              {t('admin.rejectSelected')}
            </button>
            <button
              type="button"
              className="op-account-btn"
              disabled={content.bulkReviewBusy}
              onClick={() => setSelectedIds(new Set())}
            >
              {t('admin.clearSelection')}
            </button>
          </div>
        </div>
      ) : null}

      <AccountTemplateTable
        locale={locale}
        t={t}
        items={content.adminItems}
        admin
        loading={content.adminLoading}
        selection={{
          selected: selectedIds,
          onToggle: toggleSelection,
          onToggleAll: toggleSelectAll,
        }}
        emptyMessage={statusFilter === 'pending' ? t('admin.emptyPending') : t('admin.empty')}
        onOpenDetail={(item) => {
          if ('thumbnailUrl' in item) void openAdminDetail(item);
        }}
        onReview={(id, status) => void content.review(id, status)}
      />

      <AccountTemplateDetailDialog locale={locale} t={t} state={detail} />
    </div>
  );
}