'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { myTemplatesPageKey, type MyTemplatesPage } from '~/lib/account/my-templates-page';
import type { TemplateRecord } from '~/lib/prompts/template-types';
import {
  bulkDeleteMyTemplatesAction,
  removeMyTemplateAction,
  type AccountSelectionUpdater,
  type AccountTranslateFn,
} from './account-actions';
import { loadMyTemplatesPage, loadMyTemplatesStats } from './account-api';
import type { AccountPanel } from './account-types';

export type MyTemplatesContentState = {
  templates: TemplateRecord[];
  templateCount: number | null;
  myPendingCount: number | null;
  myLoading: boolean;
  myTotal: number | null;
  myHasMore: boolean;
  bulkMyDeleteBusy: boolean;
  loadStats: () => Promise<void>;
  loadMyTemplates: () => Promise<void>;
  removeTemplate: (id: number) => Promise<void>;
  bulkDeleteMyTemplates: () => Promise<void>;
};

type MyTemplatesQuery = {
  search: string;
  statusFilter: string;
  page: number;
  pageSize: number;
};

type MyTemplatesSelection = {
  selectedIds: Set<number>;
  setSelectedIds: AccountSelectionUpdater;
};

export function useMyTemplatesContent(args: {
  locale: string;
  panel: AccountPanel;
  t: AccountTranslateFn;
  query: MyTemplatesQuery;
  selection: MyTemplatesSelection;
}): MyTemplatesContentState {
  const loadGenerationRef = useRef(0);
  const prefetchRef = useRef<{ key: string; data: MyTemplatesPage } | null>(null);

  const [templates, setTemplates] = useState<TemplateRecord[]>([]);
  const [templateCount, setTemplateCount] = useState<number | null>(null);
  const [myPendingCount, setMyPendingCount] = useState<number | null>(null);
  const [myLoading, setMyLoading] = useState(false);
  const [myTotal, setMyTotal] = useState<number | null>(null);
  const [myHasMore, setMyHasMore] = useState(false);
  const [bulkMyDeleteBusy, setBulkMyDeleteBusy] = useState(false);

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

  const prefetchPage = useCallback(
    async (page: number, generation: number) => {
      const key = myTemplatesPageKey(
        args.query.search,
        args.query.statusFilter,
        page,
        args.query.pageSize,
      );
      if (prefetchRef.current?.key === key) return;

      try {
        const result = await loadMyTemplatesPage(args.locale, {
          search: args.query.search,
          statusFilter: args.query.statusFilter,
          page,
          pageSize: args.query.pageSize,
        });
        if (generation !== loadGenerationRef.current || !result.ok) return;
        if (prefetchRef.current?.key === key) return;
        prefetchRef.current = { key, data: result.page };
      } catch {
        // Prefetch is optional and must not affect the visible page.
      }
    },
    [args.locale, args.query.pageSize, args.query.search, args.query.statusFilter],
  );

  const loadMyTemplates = useCallback(async () => {
    const pageKey = myTemplatesPageKey(
      args.query.search,
      args.query.statusFilter,
      args.query.page,
      args.query.pageSize,
    );
    const cached = prefetchRef.current;

    if (cached?.key === pageKey) {
      setTemplates(cached.data.items);
      setMyTotal(cached.data.total);
      setMyHasMore(cached.data.hasMore);
      prefetchRef.current = null;
      if (cached.data.hasMore) {
        void prefetchPage(args.query.page + 1, loadGenerationRef.current);
      }
      return;
    }

    const generation = ++loadGenerationRef.current;
    setMyLoading(true);
    try {
      const result = await loadMyTemplatesPage(args.locale, {
        search: args.query.search,
        statusFilter: args.query.statusFilter,
        page: args.query.page,
        pageSize: args.query.pageSize,
      });
      if (generation !== loadGenerationRef.current) return;

      if (result.ok) {
        setTemplates(result.page.items);
        setMyTotal(result.page.total);
        setMyHasMore(result.page.hasMore);
        if (result.page.hasMore) void prefetchPage(args.query.page + 1, generation);
      } else {
        setTemplates([]);
        setMyTotal(null);
        setMyHasMore(false);
      }
    } catch {
      if (generation !== loadGenerationRef.current) return;
      setTemplates([]);
      setMyTotal(null);
      setMyHasMore(false);
    } finally {
      if (generation === loadGenerationRef.current) setMyLoading(false);
    }
  }, [
    args.locale,
    args.query.page,
    args.query.pageSize,
    args.query.search,
    args.query.statusFilter,
    prefetchPage,
  ]);

  useEffect(() => {
    prefetchRef.current = null;
  }, [args.query.pageSize, args.query.search, args.query.statusFilter]);

  useEffect(() => {
    if (args.panel === 'overview') void loadStats();
  }, [args.panel, loadStats]);

  useEffect(() => {
    if (args.panel === 'prompts') void loadMyTemplates();
  }, [args.panel, loadMyTemplates]);

  const removeTemplate = useCallback(
    async (id: number) => {
      await removeMyTemplateAction({
        locale: args.locale,
        confirmMessage: args.t('table.confirmDelete'),
        id,
        setSelectedMyIds: args.selection.setSelectedIds,
        resetPrefetch: () => {
          prefetchRef.current = null;
        },
        loadMyTemplates,
        loadStats,
      });
    },
    [args.locale, args.selection.setSelectedIds, args.t, loadMyTemplates, loadStats],
  );

  const bulkDeleteMyTemplates = useCallback(async () => {
    await bulkDeleteMyTemplatesAction({
      locale: args.locale,
      confirmMessage: args.t('table.bulkConfirmDelete', {
        count: args.selection.selectedIds.size,
      }),
      selectedIds: args.selection.selectedIds,
      setSelectedMyIds: args.selection.setSelectedIds,
      resetPrefetch: () => {
        prefetchRef.current = null;
      },
      loadMyTemplates,
      loadStats,
      setBusy: setBulkMyDeleteBusy,
    });
  }, [
    args.locale,
    args.selection.selectedIds,
    args.selection.setSelectedIds,
    args.t,
    loadMyTemplates,
    loadStats,
  ]);

  return {
    templates,
    templateCount,
    myPendingCount,
    myLoading,
    myTotal,
    myHasMore,
    bulkMyDeleteBusy,
    loadStats,
    loadMyTemplates,
    removeTemplate,
    bulkDeleteMyTemplates,
  };
}