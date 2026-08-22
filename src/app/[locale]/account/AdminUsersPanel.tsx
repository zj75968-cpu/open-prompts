'use client';

import { useEffect, useState } from 'react';
import { UserAvatar } from '~/components/open-prompts/UserAvatar';
import type { AdminUserTrendRange } from '~/lib/users/admin-user-trend';
import type { AccountTranslateFn } from './account-actions';
import { AccountDailyTrend, AccountPagination } from './account-list-components';
import { formatJoinedAt, formatProviderLabels } from './account-utils';
import { useAdminUsersContent } from './use-admin-users-content';

export function AdminUsersPanel({
  active,
  locale,
  isAdmin,
  t,
}: {
  active: boolean;
  locale: string;
  isAdmin: boolean;
  t: AccountTranslateFn;
}) {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [trendDays, setTrendDays] = useState<AdminUserTrendRange>(30);

  useEffect(() => {
    setPage(1);
  }, [search, pageSize, trendDays]);

  const content = useAdminUsersContent({
    locale,
    isAdmin,
    active,
    t,
    query: { search, page, pageSize, trendDays },
  });

  useEffect(() => {
    if (!active) content.closeUserDetail();
  }, [active, content.closeUserDetail]);

  const usersTable = content.usersLoading ? (
    <div className="op-account-empty">{t('loading')}</div>
  ) : !content.userItems.length ? (
    <div className="op-account-empty">{t('adminUsers.empty')}</div>
  ) : (
    <div className="op-account-card op-account-table-wrap">
      <table className="op-account-table">
        <thead>
          <tr>
            <th>{t('adminUsers.colUser')}</th>
            <th>{t('adminUsers.colRole')}</th>
            <th>{t('adminUsers.colProvider')}</th>
            <th>{t('adminUsers.colJoined')}</th>
            <th className="op-account-th-actions">{t('table.actions')}</th>
          </tr>
        </thead>
        <tbody>
          {content.userItems.map((item) => (
            <tr
              key={item.id}
              className="cursor-pointer"
              onClick={() => void content.openUserDetail(item)}
            >
              <td>
                <div className="flex items-center gap-2.5">
                  <div className="op-account-avatar h-8 w-8 shrink-0 overflow-hidden rounded-full">
                    <UserAvatar
                      image={item.image}
                      seed={item.email || item.id}
                      name={item.name}
                      size={32}
                    />
                  </div>
                  <div className="min-w-0">
                    <div className="truncate font-medium text-[var(--text)]">
                      {item.name || item.email}
                    </div>
                    <div className="truncate text-[10px] text-[var(--text3)]">{item.email}</div>
                  </div>
                </div>
              </td>
              <td>
                {item.isEnvAdmin ? (
                  <span className="op-account-status pub">{t('adminUsers.envAdmin')}</span>
                ) : (
                  <span className="text-[11px] text-[var(--text3)]">{t('adminUsers.member')}</span>
                )}
              </td>
              <td className="text-[11px] text-[var(--text3)]">
                {item.providers.length
                  ? formatProviderLabels(item.providers)
                  : t('adminUsers.providerEmail')}
              </td>
              <td className="text-[11px] text-[var(--text3)]">
                {formatJoinedAt(item.createdAt, locale)}
              </td>
              <td className="op-account-td-actions" onClick={(event) => event.stopPropagation()}>
                <div className="op-account-row-actions">
                  <button
                    type="button"
                    className="op-account-row-btn"
                    onClick={() => void content.openUserDetail(item)}
                  >
                    {t('table.view')}
                  </button>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className={`op-account-panel${active ? ' active' : ''}`}>
      <p className="mb-3 text-sm text-[var(--text2)]">{t('adminUsers.hint')}</p>
      <div className="op-account-metrics mb-4">
        <div className="op-account-metric">
          <div className="op-account-metric-label">{t('adminUsers.metricTotal')}</div>
          <div className="op-account-metric-value">
            {content.usersLoading && content.usersPlatformTotal == null
              ? '…'
              : (content.usersPlatformTotal ?? '—')}
          </div>
        </div>
        <div className="op-account-metric">
          <div className="op-account-metric-label">{t('adminUsers.metricActiveToday')}</div>
          <div className="op-account-metric-value">
            {content.usersLoading && content.usersActiveToday == null
              ? '…'
              : (content.usersActiveToday ?? '—')}
          </div>
        </div>
        <div className="op-account-metric">
          <div className="op-account-metric-label">{t('adminUsers.metricNewToday')}</div>
          <div className="op-account-metric-value">
            {content.usersLoading && content.usersNewToday == null
              ? '…'
              : (content.usersNewToday ?? '—')}
          </div>
        </div>
      </div>

      <AccountDailyTrend
        locale={locale}
        t={t}
        points={content.usersDailyTrend}
        loading={content.usersLoading}
        trendDays={trendDays}
        setTrendDays={setTrendDays}
        hintKey="adminUsers.trendDaysHint"
        titleKey="adminUsers.trendUsersTitle"
      />

      {content.usersLoadError ? (
        <p className="mb-3 text-sm text-[var(--coral)]">
          {t('adminUsers.loadError', { message: content.usersLoadError })}
        </p>
      ) : null}

      <div className="op-account-toolbar">
        <input
          className="op-account-search"
          placeholder={t('adminUsers.searchPlaceholder')}
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void content.loadAdminUsers();
          }}
        />
        <button
          type="button"
          className="op-account-btn"
          onClick={() => void content.loadAdminUsers()}
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
        total={content.usersTotal}
        hasMore={content.usersHasMore}
        loading={content.usersLoading}
      />

      {usersTable}

      {content.userDetailOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          role="dialog"
          aria-modal="true"
          onClick={content.closeUserDetail}
        >
          <div
            className="op-account-card max-h-[85vh] w-full max-w-md overflow-y-auto p-5"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <h2 className="text-base font-semibold text-[var(--text)]">
                {t('adminUsers.detailTitle')}
              </h2>
              <button type="button" className="op-account-row-btn" onClick={content.closeUserDetail}>
                {t('adminUsers.close')}
              </button>
            </div>
            {content.userDetailLoading ? (
              <p className="text-sm text-[var(--text2)]">{t('loading')}</p>
            ) : content.userDetailError ? (
              <p className="text-sm text-[var(--coral)]">{content.userDetailError}</p>
            ) : content.userDetail ? (
              <dl className="space-y-3 text-sm">
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-[var(--text3)]">
                    {t('adminUsers.colUser')}
                  </dt>
                  <dd className="mt-0.5 font-medium">
                    {content.userDetail.name || content.userDetail.email}
                  </dd>
                  <dd className="text-xs text-[var(--text2)]">{content.userDetail.email}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-[var(--text3)]">
                    {t('adminUsers.colRole')}
                  </dt>
                  <dd className="mt-0.5">
                    {content.userDetail.isEnvAdmin
                      ? t('adminUsers.envAdmin')
                      : t('adminUsers.member')}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-[var(--text3)]">
                    {t('adminUsers.providers')}
                  </dt>
                  <dd className="mt-0.5 text-[var(--text2)]">
                    {content.userDetail.providers.length
                      ? formatProviderLabels(content.userDetail.providers)
                      : t('adminUsers.noProviders')}
                  </dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-[var(--text3)]">
                    {t('adminUsers.templateCount')}
                  </dt>
                  <dd className="mt-0.5 text-[var(--text2)]">{content.userDetail.templateCount}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-wide text-[var(--text3)]">
                    {t('adminUsers.colJoined')}
                  </dt>
                  <dd className="mt-0.5 text-[var(--text2)]">
                    {formatJoinedAt(content.userDetail.createdAt, locale)}
                  </dd>
                </div>
              </dl>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}