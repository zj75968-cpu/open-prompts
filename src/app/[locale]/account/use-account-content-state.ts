'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AdminTemplateRecord, TemplateRecord } from '~/lib/prompts/template-types';
import type { AdminUserDetail, AdminUserSummary } from '~/lib/users/admin-user-record';
import type { DailyCountPoint, AdminUserTrendRange } from '~/lib/users/admin-user-trend';
import { myTemplatesPageKey, type MyTemplatesPage } from '~/lib/account/my-templates-page';
import {
  loadAdminTemplatesBadge,
  loadAdminTemplatesPage,
  loadAdminUsersPage,
  loadMyTemplatesPage,
  loadMyTemplatesStats,
} from './account-api';
import {
  bulkDeleteMyTemplatesAction,
  bulkReviewAdminTemplatesAction,
  openAdminUserDetailAction,
  removeMyTemplateAction,
  reviewAdminTemplateAction,
  type AccountReloadFn,
  type AccountSelectionUpdater,
  type AccountTranslateFn,
} from './account-actions';
import type { AccountPanel } from './account-types';

export type AccountContentState = {
  templates: TemplateRecord[];
  templateCount: number | null;
  myPendingCount: number | null;
  myLoading: boolean;
  myTotal: number | null;
  myHasMore: boolean;
  adminItems: AdminTemplateRecord[];
  adminPendingCount: number | null;
  adminPromptsDailyTrend: DailyCountPoint[];
  adminTotal: number | null;
  adminHasMore: boolean;
  adminLoading: boolean;
  adminLoadError: string | null;
  bulkReviewBusy: boolean;
  bulkMyDeleteBusy: boolean;
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
  loadStats: () => Promise<void>;
  loadMyTemplates: () => Promise<void>;
  loadAdminTemplates: () => Promise<void>;
  loadAdminUsers: () => Promise<void>;
  removeTemplate: (id: number) => Promise<void>;
  bulkDeleteMyTemplates: () => Promise<void>;
  review: (id: number, status: 'approved' | 'rejected') => Promise<void>;
  bulkReview: (status: 'approved' | 'rejected') => Promise<void>;
  openUserDetail: (summary: AdminUserSummary) => Promise<void>;
  closeUserDetail: () => void;
};

export function useAccountContentState(args: {
  locale: string;
  isAdmin: boolean;
  panel: AccountPanel;
  userEmail: string;
  t: AccountTranslateFn;
  initialAdmin?: {
    items: AdminTemplateRecord[];
    total: number | null;
    hasMore: boolean;
    pendingCount: number;
    promptsDailyTrend: DailyCountPoint[];
  } | null;
  search: string;
  myStatusFilter: string;
  myPage: number;
  myPageSize: number;
  adminSearch: string;
  adminStatusFilter: string;
  adminPage: number;
  adminPageSize: number;
  adminTrendDays: AdminUserTrendRange;
  usersSearch: string;
  usersPage: number;
  usersPageSize: number;
  usersTrendDays: AdminUserTrendRange;
  selectedMyIds: Set<number>;
  setSelectedMyIds: AccountSelectionUpdater;
  selectedAdminIds: Set<number>;
  setSelectedAdminIds: AccountSelectionUpdater;
}): AccountContentState {
  const adminLoadGen = useRef(0);
  const adminItemsCountRef = useRef(args.initialAdmin?.items.length ?? 0);
  const adminPrefetchedRef = useRef(Boolean(args.initialAdmin?.items.length));
  const myTemplatesLoadGen = useRef(0);
  const myTemplatesPrefetchRef = useRef<{ key: string; data: MyTemplatesPage } | null>(null);

  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
  const [templateCount, setTemplateCount] = useState<number | null>(null);
  const [myPendingCount, setMyPendingCount] = useState<number | null>(null);
  const [myLoading, setMyLoading] = useState(false);
  const [myTotal, setMyTotal] = useState<number | null>(null);
  const [myHasMore, setMyHasMore] = useState(false);

  const [adminItems, setAdminItems] = useState<AdminTemplateRecord[]>(args.initialAdmin?.items ?? []);
  const [adminPendingCount, setAdminPendingCount] = useState<number | null>(
    args.initialAdmin?.pendingCount ?? null,
  );
  const [adminPromptsDailyTrend, setAdminPromptsDailyTrend] = useState<DailyCountPoint[]>(
    args.initialAdmin?.promptsDailyTrend ?? [],
  );
  const [adminTotal, setAdminTotal] = useState<number | null>(args.initialAdmin?.total ?? null);
  const [adminHasMore, setAdminHasMore] = useState(args.initialAdmin?.hasMore ?? false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminLoadError, setAdminLoadError] = useState<string | null>(null);
  const [bulkReviewBusy, setBulkReviewBusy] = useState(false);
  const [bulkMyDeleteBusy, setBulkMyDeleteBusy] = useState(false);

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

  useEffect(() => {
    adminItemsCountRef.current = adminItems.length;
  }, [adminItems.length]);

  const loadStats = useCallback(async () => {
    try {
      const stats = await loadMyTemplatesStats(args.locale);
      setTemplateCount(stats.templateCount);
      setMyPendingCount(stats.pendingCount);
    } catch {
      setTemplateCount(null);
      setMyPendingCount(null);
    }
  }, [args.locale]);

  const prefetchMyTemplatesPage = useCallback(
    async (page: number, gen: number) => {
      const key = myTemplatesPageKey(args.search, args.myStatusFilter, page, args.myPageSize);
      if (myTemplatesPrefetchRef.current?.key === key) return;
      try {
        const result = await loadMyTemplatesPage(args.locale, {
          search: args.search,
          statusFilter: args.myStatusFilter,
          page,
          pageSize: args.myPageSize,
        });
        if (gen !== myTemplatesLoadGen.current || !result.ok) return;
        if (myTemplatesPrefetchRef.current?.key === key) return;
        myTemplatesPrefetchRef.current = { key, data: result.page };
      } catch {
        /* optional prefetch */
      }
    },
    [args.locale, args.myPageSize, args.myStatusFilter, args.search],
  );

  const loadMyTemplates = useCallback(async () => {
    const pageKey = myTemplatesPageKey(args.search, args.myStatusFilter, args.myPage, args.myPageSize);
    const cached = myTemplatesPrefetchRef.current;
    if (cached?.key === pageKey) {
      setTemplates(cached.data.items);
      setMyTotal(cached.data.total);
      setMyHasMore(cached.data.hasMore);
      myTemplatesPrefetchRef.current = null;
      if (cached.data.hasMore) {
        void prefetchMyTemplatesPage(args.myPage + 1, myTemplatesLoadGen.current);
      }
      return;
    }

    const gen = ++myTemplatesLoadGen.current;
    setMyLoading(true);
    try {
      const result = await loadMyTemplatesPage(args.locale, {
        search: args.search,
        statusFilter: args.myStatusFilter,
        page: args.myPage,
        pageSize: args.myPageSize,
      });
      if (gen !== myTemplatesLoadGen.current) return;
      if (result.ok) {
        setTemplates(result.page.items);
        setMyTotal(result.page.total);
        setMyHasMore(result.page.hasMore);
        if (result.page.hasMore) void prefetchMyTemplatesPage(args.myPage + 1, gen);
      } else {
        setTemplates([]);
        setMyTotal(null);
        setMyHasMore(false);
      }
    } catch {
      if (gen !== myTemplatesLoadGen.current) return;
      setTemplates([]);
      setMyTotal(null);
      setMyHasMore(false);
    } finally {
      if (gen === myTemplatesLoadGen.current) setMyLoading(false);
    }
  }, [args.locale, args.myPage, args.myPageSize, args.myStatusFilter, args.search, prefetchMyTemplatesPage]);

  const loadAdminTemplates = useCallback(async () => {
    const gen = ++adminLoadGen.current;
    setAdminLoading(true);
    setAdminLoadError(null);

    const ac = new AbortController();
    const timeoutId = window.setTimeout(() => ac.abort(), 60_000);

    try {
      const result = await loadAdminTemplatesPage(args.locale, {
        search: args.adminSearch,
        statusFilter: args.adminStatusFilter,
        page: args.adminPage,
        pageSize: args.adminPageSize,
        trendDays: args.adminTrendDays,
        signal: ac.signal,
      });
      if (gen !== adminLoadGen.current) return;
      if (result.ok) {
        setAdminItems(result.data.items);
        setAdminTotal(result.data.total);
        setAdminHasMore(result.data.hasMore);
        if (result.data.pendingCount != null) setAdminPendingCount(result.data.pendingCount);
        setAdminPromptsDailyTrend(result.data.promptsDailyTrend);
      } else {
        if (result.status === 403) {
          setAdminLoadError(args.t('admin.forbiddenBody', { email: args.userEmail || '—' }));
        } else {
          setAdminLoadError(`HTTP ${result.status}`);
        }
        if (!adminItemsCountRef.current) {
          setAdminItems([]);
          setAdminTotal(null);
          setAdminHasMore(false);
          setAdminPromptsDailyTrend([]);
        }
      }
    } catch (e: unknown) {
      if (gen !== adminLoadGen.current) return;
      if (e instanceof DOMException && e.name === 'AbortError') {
        if (!adminItemsCountRef.current) {
          setAdminLoadError(args.t('admin.loadTimeout'));
        }
        return;
      }
      const msg = e instanceof Error ? e.message : 'Network error';
      setAdminLoadError(msg);
      if (!adminItemsCountRef.current) {
        setAdminItems([]);
        setAdminTotal(null);
        setAdminHasMore(false);
        setAdminPromptsDailyTrend([]);
      }
    } finally {
      window.clearTimeout(timeoutId);
      if (gen === adminLoadGen.current) setAdminLoading(false);
    }
  }, [
    args.adminPage,
    args.adminPageSize,
    args.adminSearch,
    args.adminStatusFilter,
    args.adminTrendDays,
    args.locale,
    args.t,
    args.userEmail,
  ]);

  const loadAdminUsers = useCallback(async () => {
    setUsersLoading(true);
    setUsersLoadError(null);

    const ac = new AbortController();
    const timeoutId = window.setTimeout(() => ac.abort(), 25_000);

    try {
      const result = await loadAdminUsersPage(args.locale, {
        search: args.usersSearch,
        page: args.usersPage,
        pageSize: args.usersPageSize,
        trendDays: args.usersTrendDays,
        signal: ac.signal,
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
      } else {
        setUserItems([]);
        setUsersTotal(null);
        setUsersPlatformTotal(null);
        setUsersActiveToday(null);
        setUsersNewToday(null);
        setUsersDailyTrend([]);
        setUsersHasMore(false);
        setUsersLoadError(result.error ?? `HTTP ${result.status}`);
      }
    } catch (e: unknown) {
      setUserItems([]);
      setUsersTotal(null);
      setUsersPlatformTotal(null);
      setUsersActiveToday(null);
      setUsersNewToday(null);
      setUsersDailyTrend([]);
      setUsersHasMore(false);
      const msg = e instanceof Error ? e.message : 'Network error';
      setUsersLoadError(
        e instanceof DOMException && e.name === 'AbortError' ? args.t('adminUsers.loadTimeout') : msg,
      );
    } finally {
      window.clearTimeout(timeoutId);
      setUsersLoading(false);
    }
  }, [args.locale, args.t, args.usersPage, args.usersPageSize, args.usersSearch, args.usersTrendDays]);

  useEffect(() => {
    myTemplatesPrefetchRef.current = null;
  }, [args.myPageSize, args.myStatusFilter, args.search]);

  useEffect(() => {
    if (args.panel === 'overview') void loadStats();
  }, [args.panel, loadStats]);

  useEffect(() => {
    if (!args.isAdmin) return;
    let cancelled = false;
    void (async () => {
      try {
        const pendingCount = await loadAdminTemplatesBadge(args.locale);
        if (!cancelled && typeof pendingCount === 'number') setAdminPendingCount(pendingCount);
      } catch {
        /* optional nav badge */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [args.isAdmin, args.locale]);

  useEffect(() => {
    if (args.panel === 'prompts') void loadMyTemplates();
  }, [args.panel, loadMyTemplates]);

  useEffect(() => {
    if (args.panel !== 'admin' || !args.isAdmin) return;
    if (adminPrefetchedRef.current) {
      adminPrefetchedRef.current = false;
      return;
    }
    void loadAdminTemplates();
  }, [args.isAdmin, args.panel, loadAdminTemplates]);

  useEffect(() => {
    if (args.panel === 'users' && args.isAdmin) void loadAdminUsers();
  }, [args.isAdmin, args.panel, loadAdminUsers]);

  const removeTemplate = useCallback(
    async (id: number) => {
      await removeMyTemplateAction({
        locale: args.locale,
        confirmMessage: args.t('table.confirmDelete'),
        id,
        setSelectedMyIds: args.setSelectedMyIds,
        resetPrefetch: () => {
          myTemplatesPrefetchRef.current = null;
        },
        loadMyTemplates,
        loadStats,
      });
    },
    [args.locale, args.setSelectedMyIds, args.t, loadMyTemplates, loadStats],
  );

  const bulkDeleteMyTemplates = useCallback(async () => {
    await bulkDeleteMyTemplatesAction({
      locale: args.locale,
      confirmMessage: args.t('table.bulkConfirmDelete', { count: args.selectedMyIds.size }),
      selectedIds: args.selectedMyIds,
      setSelectedMyIds: args.setSelectedMyIds,
      resetPrefetch: () => {
        myTemplatesPrefetchRef.current = null;
      },
      loadMyTemplates,
      loadStats,
      setBusy: setBulkMyDeleteBusy,
    });
  }, [args.locale, args.selectedMyIds, args.setSelectedMyIds, args.t, loadMyTemplates, loadStats]);

  const review = useCallback(
    async (id: number, status: 'approved' | 'rejected') => {
      await reviewAdminTemplateAction({
        locale: args.locale,
        id,
        status,
        setSelectedAdminIds: args.setSelectedAdminIds,
        loadAdminTemplates,
        loadStats,
      });
    },
    [args.locale, args.setSelectedAdminIds, loadAdminTemplates, loadStats],
  );

  const bulkReview = useCallback(
    async (status: 'approved' | 'rejected') => {
      const confirmKey = status === 'approved' ? 'admin.bulkConfirmApprove' : 'admin.bulkConfirmReject';
      await bulkReviewAdminTemplatesAction({
        locale: args.locale,
        confirmMessage: args.t(confirmKey, { count: args.selectedAdminIds.size }),
        selectedIds: args.selectedAdminIds,
        status,
        setSelectedAdminIds: args.setSelectedAdminIds,
        loadAdminTemplates,
        loadStats,
        setBusy: setBulkReviewBusy,
      });
    },
    [args.locale, args.selectedAdminIds, args.setSelectedAdminIds, args.t, loadAdminTemplates, loadStats],
  );

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
    templates,
    templateCount,
    myPendingCount,
    myLoading,
    myTotal,
    myHasMore,
    adminItems,
    adminPendingCount,
    adminPromptsDailyTrend,
    adminTotal,
    adminHasMore,
    adminLoading,
    adminLoadError,
    bulkReviewBusy,
    bulkMyDeleteBusy,
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
    loadStats,
    loadMyTemplates,
    loadAdminTemplates,
    loadAdminUsers,
    removeTemplate,
    bulkDeleteMyTemplates,
    review,
    bulkReview,
    openUserDetail,
    closeUserDetail,
  };
}
