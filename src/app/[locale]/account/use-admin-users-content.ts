'use client';

import { useCallback, useEffect, useState } from 'react';
import type { AdminUserDetail, AdminUserSummary } from '~/lib/users/admin-user-record';
import type { AdminUserTrendRange, DailyCountPoint } from '~/lib/users/admin-user-trend';
import { openAdminUserDetailAction, type AccountTranslateFn } from './account-actions';
import { loadAdminUsersPage } from './account-api';
import type { AccountPanel } from './account-types';

export type AdminUsersContentState = {
  userItems: AdminUserSummary[];
  usersTotal: number | null;
  usersPlatformTotal: number | null;
  usersActiveToday: number | null;
  usersNewToday: number | null;
  usersDailyTrend: DailyCountPoint[];
  usersHasMore: boolean;
  usersLoading: boolean;
  usersLoadError: string | null;
  userDetailOpen: boolean;
  userDetail: AdminUserDetail | null;
  userDetailLoading: boolean;
  userDetailError: string | null;
  loadAdminUsers: () => Promise<void>;
  openUserDetail: (summary: AdminUserSummary) => Promise<void>;
  closeUserDetail: () => void;
};

type AdminUsersQuery = {
  search: string;
  page: number;
  pageSize: number;
  trendDays: AdminUserTrendRange;
};

export function useAdminUsersContent(args: {
  locale: string;
  isAdmin: boolean;
  panel: AccountPanel;
  t: AccountTranslateFn;
  query: AdminUsersQuery;
}): AdminUsersContentState {
  const [userItems, setUserItems] = useState<AdminUserSummary[]>([]);
  const [usersTotal, setUsersTotal] = useState<number | null>(null);
  const [usersPlatformTotal, setUsersPlatformTotal] = useState<number | null>(null);
  const [usersActiveToday, setUsersActiveToday] = useState<number | null>(null);
  const [usersNewToday, setUsersNewToday] = useState<number | null>(null);
  const [usersDailyTrend, setUsersDailyTrend] = useState<DailyCountPoint[]>([]);
  const [usersHasMore, setUsersHasMore] = useState(false);
  const [usersLoading, setUsersLoading] = useState(false);
  const [usersLoadError, setUsersLoadError] = useState<string | null>(null);
  const [userDetailOpen, setUserDetailOpen] = useState(false);
  const [userDetail, setUserDetail] = useState<AdminUserDetail | null>(null);
  const [userDetailLoading, setUserDetailLoading] = useState(false);
  const [userDetailError, setUserDetailError] = useState<string | null>(null);

  const clearUsers = useCallback(() => {
    setUserItems([]);
    setUsersTotal(null);
    setUsersPlatformTotal(null);
    setUsersActiveToday(null);
    setUsersNewToday(null);
    setUsersDailyTrend([]);
    setUsersHasMore(false);
  }, []);

  const loadAdminUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersLoadError(null);

    const abortController = new AbortController();
    const timeoutId = window.setTimeout(() => abortController.abort(), 25_000);

    try {
      const result = await loadAdminUsersPage(args.locale, {
        search: args.query.search,
        page: args.query.page,
        pageSize: args.query.pageSize,
        trendDays: args.query.trendDays,
        signal: abortController.signal,
      });

      if (result.ok) {
        setUserItems(result.data.items);
        setUsersTotal(result.data.total);
        setUsersHasMore(result.data.hasMore);
        if (result.data.stats) {
          setUsersPlatformTotal(result.data.stats.totalUsers);
          setUsersActiveToday(result.data.stats.activeToday);
          setUsersNewToday(result.data.stats.newToday);
          setUsersDailyTrend(result.data.stats.usersDailyTrend);
        }
        return;
      }

      clearUsers();
      setUsersLoadError(result.error ?? `HTTP ${result.status}`);
    } catch (error: unknown) {
      clearUsers();
      const message = error instanceof Error ? error.message : 'Network error';
      setUsersLoadError(
        error instanceof DOMException && error.name === 'AbortError'
          ? args.t('adminUsers.loadTimeout')
          : message,
      );
    } finally {
      window.clearTimeout(timeoutId);
      setUsersLoading(false);
    }
  }, [
    args.locale,
    args.query.page,
    args.query.pageSize,
    args.query.search,
    args.query.trendDays,
    args.t,
    clearUsers,
  ]);

  useEffect(() => {
    if (args.panel === 'users' && args.isAdmin) void loadAdminUsers();
  }, [args.isAdmin, args.panel, loadAdminUsers]);

  const openUserDetail = useCallback(
    async (summary: AdminUserSummary) => {
      await openAdminUserDetailAction({
        locale: args.locale,
        id: summary.id,
        setDetailState: {
          setOpen: setUserDetailOpen,
          setItem: setUserDetail,
          setError: setUserDetailError,
          setLoading: setUserDetailLoading,
        },
      });
    },
    [args.locale],
  );

  const closeUserDetail = useCallback(() => {
    setUserDetailOpen(false);
    setUserDetail(null);
    setUserDetailError(null);
  }, []);

  return {
    userItems,
    usersTotal,
    usersPlatformTotal,
    usersActiveToday,
    usersNewToday,
    usersDailyTrend,
    usersHasMore,
    usersLoading,
    usersLoadError,
    userDetailOpen,
    userDetail,
    userDetailLoading,
    userDetailError,
    loadAdminUsers,
    openUserDetail,
    closeUserDetail,
  };
}