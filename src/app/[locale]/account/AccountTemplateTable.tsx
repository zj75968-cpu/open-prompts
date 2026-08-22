'use client';

import type { AdminTemplateRecord, TemplateRecord } from '~/lib/prompts/template-types';
import type { AccountTranslateFn } from './account-actions';
import { displayStatus, formatReviewDate } from './account-utils';

type TemplateItem = TemplateRecord | AdminTemplateRecord;

type TableSelection = {
  selected: Set<number>;
  onToggle: (id: number) => void;
  onToggleAll: (items: TemplateItem[]) => void;
};

export function AccountTemplateTable({
  locale,
  t,
  items,
  admin = false,
  loading,
  emptyMessage,
  selection,
  onOpenDetail,
  onEdit,
  onDelete,
  onReview,
}: {
  locale: string;
  t: AccountTranslateFn;
  items: TemplateItem[];
  admin?: boolean;
  loading: boolean;
  emptyMessage: string;
  selection?: TableSelection;
  onOpenDetail: (item: TemplateItem) => void;
  onEdit?: (item: TemplateRecord) => void;
  onDelete?: (id: number) => void;
  onReview?: (id: number, status: 'approved' | 'rejected') => void;
}) {
  if (loading) return <div className="op-account-empty">{t('loading')}</div>;
  if (!items.length) return <div className="op-account-empty">{emptyMessage}</div>;

  const pageIds = items.map((item) => item.id);
  const allPageSelected =
    Boolean(selection) && pageIds.length > 0 && pageIds.every((id) => selection!.selected.has(id));
  const somePageSelected =
    Boolean(selection) && pageIds.some((id) => selection!.selected.has(id));
  const isReviewQueue = admin && Boolean(selection);

  const renderAdminActions = (item: TemplateItem) => (
    <div className="op-account-row-actions">
      <button type="button" className="op-account-row-btn" onClick={() => onOpenDetail(item)}>
        {t('table.view')}
      </button>
      {item.status === 'pending' ? (
        <>
          <button
            type="button"
            className="op-account-row-btn approve"
            onClick={() => onReview?.(item.id, 'approved')}
          >
            {t('table.approve')}
          </button>
          <button
            type="button"
            className="op-account-row-btn reject"
            onClick={() => onReview?.(item.id, 'rejected')}
          >
            {t('table.reject')}
          </button>
        </>
      ) : null}
      {item.status === 'approved' ? (
        <button
          type="button"
          className="op-account-row-btn reject"
          onClick={() => onReview?.(item.id, 'rejected')}
        >
          {t('table.revoke')}
        </button>
      ) : null}
      {item.status === 'rejected' ? (
        <button
          type="button"
          className="op-account-row-btn approve"
          onClick={() => onReview?.(item.id, 'approved')}
        >
          {t('table.reapprove')}
        </button>
      ) : null}
    </div>
  );

  if (isReviewQueue) {
    return (
      <div className="op-account-card op-account-table-wrap op-account-table-scroll">
        <table className="op-account-table op-account-table-admin">
          <colgroup>
            <col className="op-account-col-check" />
            <col className="op-account-col-template" />
            <col className="op-account-col-status" />
            <col className="op-account-col-date" />
            <col className="op-account-col-actions" />
          </colgroup>
          <thead>
            <tr>
              <th className="op-account-th-check">
                <input
                  type="checkbox"
                  className="op-account-check"
                  checked={allPageSelected}
                  ref={(element) => {
                    if (element) element.indeterminate = somePageSelected && !allPageSelected;
                  }}
                  aria-label={t('admin.selectAll')}
                  onChange={() => selection!.onToggleAll(items)}
                />
              </th>
              <th>{t('table.template')}</th>
              <th>{t('table.status')}</th>
              <th>{t('table.updated')}</th>
              <th className="op-account-th-actions">{t('table.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => {
              const status = displayStatus(item);
              const thumbnail = item.images[0];
              const ownerLabel =
                'submitterEmail' in item
                  ? item.submitterEmail ?? t('table.ownerAnonymous')
                  : t('table.ownerAnonymous');
              return (
                <tr
                  key={item.id}
                  className={`cursor-pointer${selection!.selected.has(item.id) ? ' op-account-row-selected' : ''}`}
                  onClick={() => onOpenDetail(item)}
                >
                  <td className="op-account-td-check" onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="op-account-check"
                      checked={selection!.selected.has(item.id)}
                      aria-label={item.title}
                      onChange={() => selection!.onToggle(item.id)}
                    />
                  </td>
                  <td className="op-account-td-template">
                    <div className="op-account-cell-template">
                      {thumbnail ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={thumbnail} alt="" className="op-account-thumb" />
                      ) : (
                        <div className="op-account-thumb flex items-center justify-center text-sm">🖼</div>
                      )}
                      <div className="op-account-cell-template-body">
                        <button
                          type="button"
                          className="op-account-cell-title"
                          onClick={(event) => {
                            event.stopPropagation();
                            onOpenDetail(item);
                          }}
                        >
                          {item.title}
                        </button>
                        <div className="op-account-cell-template-meta">
                          <span>#{item.id}</span>
                          <span className="op-account-cell-sep" aria-hidden>·</span>
                          <span className="op-account-cell-owner" title={ownerLabel}>{ownerLabel}</span>
                          {item.model ? (
                            <>
                              <span className="op-account-cell-sep op-account-cell-sep-model" aria-hidden>·</span>
                              <span className="op-account-cell-model" title={item.model}>{item.model}</span>
                            </>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="op-account-td-status">
                    <span className={`op-account-status ${status}`}>{t(`status.${status}`)}</span>
                  </td>
                  <td className="op-account-td-date">{formatReviewDate(item.updatedAt, locale)}</td>
                  <td className="op-account-td-actions" onClick={(event) => event.stopPropagation()}>
                    {renderAdminActions(item)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  return (
    <div className="op-account-card op-account-table-wrap">
      <table className="op-account-table">
        <thead>
          <tr>
            {selection ? (
              <th className="op-account-th-check">
                <input
                  type="checkbox"
                  className="op-account-check"
                  checked={allPageSelected}
                  ref={(element) => {
                    if (element) element.indeterminate = somePageSelected && !allPageSelected;
                  }}
                  aria-label={t('admin.selectAll')}
                  onChange={() => selection.onToggleAll(items)}
                />
              </th>
            ) : null}
            <th>{t('table.template')}</th>
            {admin ? <th>{t('table.owner')}</th> : null}
            <th>{t('table.status')}</th>
            <th>{t('table.model')}</th>
            <th>{t('table.updated')}</th>
            <th className="op-account-th-actions">{t('table.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const status = displayStatus(item);
            const thumbnail = item.images[0];
            const ownerLabel =
              admin && 'submitterEmail' in item
                ? item.submitterEmail ?? t('table.ownerAnonymous')
                : null;
            return (
              <tr
                key={item.id}
                className={`cursor-pointer${selection?.selected.has(item.id) ? ' op-account-row-selected' : ''}`}
                onClick={() => onOpenDetail(item)}
              >
                {selection ? (
                  <td className="op-account-td-check" onClick={(event) => event.stopPropagation()}>
                    <input
                      type="checkbox"
                      className="op-account-check"
                      checked={selection.selected.has(item.id)}
                      aria-label={item.title}
                      onChange={() => selection.onToggle(item.id)}
                    />
                  </td>
                ) : null}
                <td>
                  <div className="flex items-center gap-2.5">
                    {thumbnail ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={thumbnail} alt="" className="op-account-thumb" />
                    ) : (
                      <div className="op-account-thumb flex items-center justify-center text-sm">🖼</div>
                    )}
                    <div className="min-w-0">
                      <button
                        type="button"
                        className="truncate text-left font-medium text-[var(--text)] hover:text-[var(--amber2)]"
                        onClick={(event) => {
                          event.stopPropagation();
                          onOpenDetail(item);
                        }}
                      >
                        {item.title}
                      </button>
                      <div className="text-[10px] text-[var(--text3)]">#{item.id}</div>
                    </div>
                  </div>
                </td>
                {admin ? (
                  <td className="max-w-[140px] truncate text-[11px] text-[var(--text2)]" title={ownerLabel ?? ''}>
                    {ownerLabel}
                  </td>
                ) : null}
                <td><span className={`op-account-status ${status}`}>{t(`status.${status}`)}</span></td>
                <td className="text-[var(--text2)]">{item.model}</td>
                <td className="text-[11px] text-[var(--text3)]">
                  {new Date(item.updatedAt).toLocaleDateString()}
                </td>
                <td className="op-account-td-actions" onClick={(event) => event.stopPropagation()}>
                  {admin ? (
                    renderAdminActions(item)
                  ) : (
                    <div className="op-account-row-actions">
                      <button
                        type="button"
                        className="op-account-row-btn"
                        onClick={() => onOpenDetail(item)}
                      >
                        {t('table.view')}
                      </button>
                      <button
                        type="button"
                        className="op-account-row-btn"
                        onClick={() => onEdit?.(item as TemplateRecord)}
                      >
                        {t('table.edit')}
                      </button>
                      <button
                        type="button"
                        className="op-account-row-btn reject"
                        onClick={() => onDelete?.(item.id)}
                      >
                        {t('table.delete')}
                      </button>
                    </div>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}