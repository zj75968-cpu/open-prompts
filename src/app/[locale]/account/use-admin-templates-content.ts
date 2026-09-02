'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { AdminTemplateSummary } from '~/lib/prompts/template-types';
import type { AdminUserTrendRange, DailyCountPoint } from '~/lib/users/admin-user-trend';
import {
  bulkReviewAdminTemplatesAction,
  reviewAdminTemplateAction,
  type AccountReloadFn,
  type AccountSelectionUpdater,
  type AccountTranslateFn,
} from './account-actions';
import { loadAdminTemplatesBadge, loadAdminTemplatesPage } from './account-api';

export type InitialAdminTemplates = {
  items: AdminTemplateSummary[];
  total: number | null;
  hasMore: boolean;
  pendingCount: number;
  promptsDailyTrend: DailyCountPoint[];
};

export type AdminTemplatesContentState = {
  adminItems: AdminTemplateSummary[];
  adminPendingCount: number | null;
  adminPromptsDailyTrend: DailyCountPoint[];
  adminTotal: number | null;
  adminHasMore: boolean;
  adminLoading: boolean;
  adminLoadError: string | null;
  bulkReviewBusy: boolean;
  loadAdminTemplates: () => Promise<void>;
  review: (id: number, status: 'approved' | 'rejected') => Promise<void>;
  bulkReview: (status: 'approved' | 'rejected') => Promise<void>;
};

type AdminTemplatesQuery = {
  search: string;
  statusFilter: string;
  page: number;
  pageSize: number;
  trendDays: AdminUserTrendRange;
};

type AdminTemplatesSelection = {
  selectedIds: Set<number>;
  setSelectedIds: AccountSelectionUpdater;
};

export function useAdminTemplatesContent(args: {
  locale: string;
  isAdmin: boolean;
  active: boolean;
  userEmail: string;
  t: AccountTranslateFn;
  initial?: InitialAdminTemplates | null;
  query: AdminTemplatesQuery;
  selection: AdminTemplatesSelection;
  refreshOverview: AccountReloadFn;
  onPendingCountChange?: (count: number | null) => void;
}): AdminTemplatesContentState {
  const loadGenerationRef = useRef(0);
  const itemsCountRef = useRef(args.initial?.items.length ?? 0);
  const prefetchedRef = useRef(Boolean(args.initial?.items.length));

  const [adminItems, setAdminItems] = useState<AdminTemplateSummary[]>(args.initial?.items ?? []);
  const [adminPendingCount, setAdminPendingCount] = useState<number | null>(
    args.initial?.pendingCount ?? null,
  );
  const [adminPromptsDailyTrend, setAdminPromptsDailyTrend] = useState<DailyCountPoint[]>(
    args.initial?.promptsDailyTrend ?? [],
  );
  const [adminTotal, setAdminTotal] = useState<number | null>(args.initial?.total ?? null);
  const [adminHasMore, setAdminHasMore] = useState(args.initial?.hasMore ?? false);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminLoadError, setAdminLoadError] = useState<string | null>(null);
  const [bulkReviewBusy, setBulkReviewBusy] = useState(false);

  useEffect(() => {
    itemsCountRef.current = adminItems.length;
  }, [adminItems.length]);

  const clearVisibleDataIfEmpty = useCallback(() => {
    if (itemsCountRef.current) return;
    setAdminItems([]);
    setAdminTotal(null);
    setAdminHasMore(false);
    setAdminPromptsDailyTrend([]);
  }, []);

  const loadAdminTemplates = useCallback(async () => {
    const generation = ++loadGenerationRef.current;
    setAdminLoading(true);
    setAdminLoadError(null);

    const abortController = new AbortController();
    const timeoutId = window.setTimeout(() => abortController.abort(), 60_000);

    try {
      const result = await loadAdminTemplatesPage(args.locale, {
        search: args.query.search,
        statusFilter: args.query.statusFilter,
        page: args.query.page,
        pageSize: args.query.pageSize,
        trendDays: args.query.trendDays,
        signal: abortController.signal,
      });
      if (generation !== loadGenerationRef.current) return;

      if (result.ok) {
        setAdminItems(result.data.items);
        setAdminTotal(result.data.total);
        setAdminHasMore(result.data.hasMore);
        if (result.data.pendingCount != null) setAdminPendingCount(result.data.pendingCount);
        setAdminPromptsDailyTrend(result.data.promptsDailyTrend);
        return;
      }

      setAdminLoadError(
        result.status === 403
          ? args.t('admin.forbiddenBody', { email: args.userEmail || '—' })
          : `HTTP ${result.status}`,
      );
      clearVisibleDataIfEmpty();
    } catch (error: unknown) {
      if (generation !== loadGenerationRef.current) return;
      if (error instanceof DOMException && error.name === 'AbortError') {
        if (!itemsCountRef.current) setAdminLoadError(args.t('admin.loadTimeout'));
        return;
      }
      setAdminLoadError(error instanceof Error ? error.message : 'Network error');
      clearVisibleDataIfEmpty();
    } finally {
      window.clearTimeout(timeoutId);
      if (generation === loadGenerationRef.current) setAdminLoading(false);
    }
  }, [
    args.locale,
    args.query.page,
    args.query.pageSize,
    args.query.search,
    args.query.statusFilter,
    args.query.trendDays,
    args.t,
    args.userEmail,
    clearVisibleDataIfEmpty,
  ]);

  useEffect(() => {
    if (!args.isAdmin) return;
    let cancelled = false;

    void (async () => {
      try {
        const pendingCount = await loadAdminTemplatesBadge(args.locale);
        if (!cancelled && typeof pendingCount === 'number') setAdminPendingCount(pendingCount);
      } catch {
        // The navigation badge is optional.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [args.isAdmin, args.locale]);

  useEffect(() => {
    args.onPendingCountChange?.(adminPendingCount);
  }, [adminPendingCount, args.onPendingCountChange]);

  useEffect(() => {
    if (!args.active || !args.isAdmin) return;
    if (prefetchedRef.current) {
      prefetchedRef.current = false;
      return;
    }
    void loadAdminTemplates();
  }, [args.active, args.isAdmin, loadAdminTemplates]);

  const review = useCallback(
    async (id: number, status: 'approved' | 'rejected') => {
      await reviewAdminTemplateAction({
        locale: args.locale,
        id,
        status,
        setSelectedAdminIds: args.selection.setSelectedIds,
        loadAdminTemplates,
        refreshOverview: args.refreshOverview,
      });
    },
    [
      args.locale,
      args.refreshOverview,
      args.selection.setSelectedIds,
      loadAdminTemplates,
    ],
  );

  const bulkReview = useCallback(
    async (status: 'approved' | 'rejected') => {
      const confirmKey =
        status === 'approved' ? 'admin.bulkConfirmApprove' : 'admin.bulkConfirmReject';
      await bulkReviewAdminTemplatesAction({
        locale: args.locale,
        confirmMessage: args.t(confirmKey, { count: args.selection.selectedIds.size }),
        selectedIds: args.selection.selectedIds,
        status,
        setSelectedAdminIds: args.selection.setSelectedIds,
        loadAdminTemplates,
        refreshOverview: args.refreshOverview,
        setBusy: setBulkReviewBusy,
      });
    },
    [
      args.locale,
      args.refreshOverview,
      args.selection.selectedIds,
      args.selection.setSelectedIds,
      args.t,
      loadAdminTemplates,
    ],
  );

  return {
    adminItems,
    adminPendingCount,
    adminPromptsDailyTrend,
    adminTotal,
    adminHasMore,
    adminLoading,
    adminLoadError,
    bulkReviewBusy,
    loadAdminTemplates,
    review,
    bulkReview,
  };
}