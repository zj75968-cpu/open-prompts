'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import type { TemplateRecord } from '~/lib/prompts/template-types';
import { submitEditorHref } from '~/lib/prompts/submit-editor-path';
import type { AccountTranslateFn } from './account-actions';
import { AccountPagination } from './account-list-components';
import {
  AccountTemplateDetailDialog,
  useAccountTemplateDetail,
} from './account-template-detail';
import { AccountTemplateTable } from './AccountTemplateTable';
import { useMyTemplatesContent } from './use-my-templates-content';

export function TemplatesPanel({
  active,
  locale,
  t,
  refreshOverview,
}: {
  active: boolean;
  locale: string;
  t: AccountTranslateFn;
  refreshOverview: () => void;
}) {
  const router = useRouter();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<number>>(() => new Set());
  const detail = useAccountTemplateDetail(t);

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
  }, [search, statusFilter, pageSize]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [page]);

  useEffect(() => {
    if (!active) detail.closeDetail();
  }, [active, detail.closeDetail]);

  const content = useMyTemplatesContent({
    locale,
    active,
    t,
    query: { search, statusFilter, page, pageSize },
    selection: { selectedIds, setSelectedIds },
    refreshOverview,
  });

  const openEdit = (item: TemplateRecord) => {
    router.push(submitEditorHref(locale, { editId: item.id }));
  };

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

  return (
    <div className={`op-account-panel${active ? ' active' : ''}`}>
      <div className="op-account-toolbar">
        <input
          className="op-account-search"
          placeholder={t('toolbar.search')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void content.loadMyTemplates();
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
          onClick={() => void content.loadMyTemplates()}
        >
          {t('toolbar.refresh')}
        </button>
        <Link
          href={submitEditorHref(locale, { visibility: 'private' })}
          className="op-account-btn primary"
        >
          {t('topbar.newTemplate')}
        </Link>
      </div>

      <AccountPagination
        t={t}
        page={page}
        setPage={setPage}
        pageSize={pageSize}
        setPageSize={setPageSize}
        total={content.myTotal}
        hasMore={content.myHasMore}
        loading={content.myLoading}
      />

      {selectedIds.size > 0 ? (
        <div className="op-account-bulk-bar">
          <span className="text-xs text-[var(--text2)]">
            {t('admin.selectedCount', { count: selectedIds.size })}
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="op-account-btn reject"
              disabled={content.bulkMyDeleteBusy}
              onClick={() => void content.bulkDeleteMyTemplates()}
            >
              {t('table.deleteSelected')}
            </button>
            <button
              type="button"
              className="op-account-btn"
              disabled={content.bulkMyDeleteBusy}
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
        items={content.templates}
        loading={content.myLoading}
        selection={{
          selected: selectedIds,
          onToggle: toggleSelection,
          onToggleAll: toggleSelectAll,
        }}
        emptyMessage={
          statusFilter.trim() !== ''
            ? t('table.emptyFiltered')
            : `${t('table.empty')} ${t('table.emptyAdminHint')}`
        }
        onOpenDetail={(item) => {
          if ('images' in item) detail.openDetail(item, false);
        }}
        onEdit={openEdit}
        onDelete={(id) => void content.removeTemplate(id)}
      />

      <AccountTemplateDetailDialog locale={locale} t={t} state={detail} onEdit={openEdit} />
    </div>
  );
}