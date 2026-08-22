'use client';

import type { Dispatch, SetStateAction } from 'react';
import {
  ADMIN_USER_TREND_RANGES,
  type AdminUserTrendRange,
  type DailyCountPoint,
} from '~/lib/users/admin-user-trend';
import type { AccountTranslateFn } from './account-actions';
import { smoothTrendPath, trendDayLabel } from './account-utils';

const PAGE_SIZES = [10, 20, 50, 100] as const;

export function AccountPagination({
  t,
  page,
  setPage,
  pageSize,
  setPageSize,
  total,
  hasMore,
  loading,
}: {
  t: AccountTranslateFn;
  page: number;
  setPage: Dispatch<SetStateAction<number>>;
  pageSize: number;
  setPageSize: Dispatch<SetStateAction<number>>;
  total: number | null;
  hasMore: boolean;
  loading: boolean;
}) {
  const totalPages =
    total != null && total >= 0 ? Math.max(1, Math.ceil(total / pageSize)) : null;
  const canPrev = page > 1;
  const canNext = totalPages != null ? page < totalPages : hasMore;

  return (
    <div className="op-account-pagination">
      <label className="flex items-center gap-2 text-xs text-[var(--text2)]">
        <span>{t('admin.pagination.pageSize')}</span>
        <select
          className="op-account-select"
          value={pageSize}
          onChange={(event) => setPageSize(Number(event.target.value))}
          disabled={loading}
        >
          {PAGE_SIZES.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </label>
      <span className="text-xs text-[var(--text3)]">
        {total != null
          ? t('admin.pagination.total', { count: total })
          : t('admin.pagination.totalUnknown')}
        {' · '}
        {totalPages != null
          ? t('admin.pagination.pageOf', { page, total: totalPages })
          : t('admin.pagination.pageOnly', { page })}
      </span>
      <div className="flex gap-2">
        <button
          type="button"
          className="op-account-btn"
          disabled={!canPrev || loading}
          onClick={() => setPage((current) => Math.max(1, current - 1))}
        >
          {t('admin.pagination.prev')}
        </button>
        <button
          type="button"
          className="op-account-btn"
          disabled={!canNext || loading}
          onClick={() => setPage((current) => current + 1)}
        >
          {t('admin.pagination.next')}
        </button>
      </div>
    </div>
  );
}

function TrendLineChart({
  locale,
  title,
  points,
}: {
  locale: string;
  title: string;
  points: DailyCountPoint[];
}) {
  const width = 320;
  const height = 120;
  const padding = { top: 12, right: 8, bottom: 22, left: 8 };
  const innerWidth = width - padding.left - padding.right;
  const innerHeight = height - padding.top - padding.bottom;
  const max = Math.max(1, ...points.map((point) => point.count));
  const pointCount = points.length;
  const coordinates = points.map((point, index) => {
    const x =
      padding.left +
      (pointCount <= 1 ? innerWidth / 2 : (index / (pointCount - 1)) * innerWidth);
    const y = padding.top + innerHeight - (point.count / max) * innerHeight;
    return { x, y, point };
  });
  const labelStep =
    pointCount <= 7 ? 1 : pointCount <= 31 ? Math.ceil(pointCount / 6) : Math.ceil(pointCount / 5);
  const labelIndices = new Set<number>([0, pointCount - 1]);
  for (let index = labelStep; index < pointCount - 1; index += labelStep) {
    labelIndices.add(index);
  }

  return (
    <div className="op-account-trend-card">
      <div className="op-account-trend-title">{title}</div>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="op-account-trend-line-svg"
        role="img"
        aria-label={title}
      >
        <line
          x1={padding.left}
          y1={padding.top + innerHeight}
          x2={padding.left + innerWidth}
          y2={padding.top + innerHeight}
          className="op-account-trend-axis"
        />
        {coordinates.length > 1 ? (
          <path d={smoothTrendPath(coordinates)} className="op-account-trend-line" fill="none" />
        ) : null}
        {coordinates.map(({ x, y, point }, index) => (
          <g key={point.date}>
            <circle
              cx={x}
              cy={y}
              r={pointCount > 31 ? 2 : 3}
              className="op-account-trend-dot"
            >
              <title>{`${point.date}: ${point.count}`}</title>
            </circle>
            {labelIndices.has(index) ? (
              <text
                x={x}
                y={height - 4}
                textAnchor="middle"
                className="op-account-trend-xlabel"
              >
                {trendDayLabel(point.date, locale)}
              </text>
            ) : null}
          </g>
        ))}
      </svg>
    </div>
  );
}

export function AccountDailyTrend({
  locale,
  t,
  points,
  loading,
  trendDays,
  setTrendDays,
  hintKey,
  titleKey,
}: {
  locale: string;
  t: AccountTranslateFn;
  points: DailyCountPoint[];
  loading: boolean;
  trendDays: AdminUserTrendRange;
  setTrendDays: (days: AdminUserTrendRange) => void;
  hintKey: 'adminUsers.trendDaysHint' | 'admin.trendDaysHint';
  titleKey: 'adminUsers.trendUsersTitle' | 'admin.trendPromptsTitle';
}) {
  if (!points.length && loading) {
    return <div className="op-account-empty mb-4 text-sm">{t('loading')}</div>;
  }
  if (!points.length) return null;

  return (
    <div className="mb-4">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[10px] text-[var(--text3)]">{t(hintKey)}</p>
        <div className="flex gap-1">
          {ADMIN_USER_TREND_RANGES.map((days) => (
            <button
              key={days}
              type="button"
              className={`op-account-trend-range-btn${trendDays === days ? ' active' : ''}`}
              onClick={() => setTrendDays(days)}
            >
              {t(
                days === 7
                  ? 'adminUsers.trendRange7'
                  : days === 30
                    ? 'adminUsers.trendRange30'
                    : 'adminUsers.trendRange90',
              )}
            </button>
          ))}
        </div>
      </div>
      <div className="op-account-trend-grid op-account-trend-grid-single">
        <TrendLineChart locale={locale} title={t(titleKey)} points={points} />
      </div>
    </div>
  );
}