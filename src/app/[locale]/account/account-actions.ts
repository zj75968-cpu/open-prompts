import { bulkDeleteMyTemplates, bulkReviewAdminTemplates, deleteMyTemplate, loadAdminUserDetail, reviewAdminTemplate } from './account-api';
import type { AdminUserDetail } from '~/lib/users/admin-user-record';

export type AccountTranslateFn = (key: string, values?: Record<string, unknown>) => string;

export type AccountSelectionUpdater = (updater: (prev: Set<number>) => Set<number>) => void;

export type AccountReloadFn = () => void;

export type AccountDetailStateSetters = {
  setOpen: (open: boolean) => void;
  setItem: (item: AdminUserDetail | null) => void;
  setError: (error: string | null) => void;
  setLoading: (loading: boolean) => void;
};

function removeSelectedId(prev: Set<number>, id: number): Set<number> {
  if (!prev.has(id)) return prev;
  const next = new Set(prev);
  next.delete(id);
  return next;
}

export async function removeMyTemplateAction(args: {
  locale: string;
  confirmMessage: string;
  id: number;
  setSelectedMyIds: AccountSelectionUpdater;
  resetPrefetch: () => void;
  loadMyTemplates: AccountReloadFn;
  loadStats: AccountReloadFn;
}): Promise<void> {
  if (!window.confirm(args.confirmMessage)) return;
  await deleteMyTemplate(args.locale, args.id);
  args.setSelectedMyIds((prev) => removeSelectedId(prev, args.id));
  args.resetPrefetch();
  void args.loadMyTemplates();
  void args.loadStats();
}

export async function bulkDeleteMyTemplatesAction(args: {
  locale: string;
  confirmMessage: string;
  selectedIds: Set<number>;
  setSelectedMyIds: AccountSelectionUpdater;
  resetPrefetch: () => void;
  loadMyTemplates: AccountReloadFn;
  loadStats: AccountReloadFn;
  setBusy: (busy: boolean) => void;
}): Promise<void> {
  const ids = Array.from(args.selectedIds);
  if (!ids.length) return;
  if (!window.confirm(args.confirmMessage)) return;

  args.setBusy(true);
  try {
    await bulkDeleteMyTemplates(args.locale, ids);
    args.setSelectedMyIds(() => new Set());
    args.resetPrefetch();
    void args.loadMyTemplates();
    void args.loadStats();
  } finally {
    args.setBusy(false);
  }
}

export async function reviewAdminTemplateAction(args: {
  locale: string;
  id: number;
  status: 'approved' | 'rejected';
  setSelectedAdminIds: AccountSelectionUpdater;
  loadAdminTemplates: AccountReloadFn;
  loadStats: AccountReloadFn;
}): Promise<void> {
  await reviewAdminTemplate(args.locale, args.id, args.status);
  args.setSelectedAdminIds((prev) => removeSelectedId(prev, args.id));
  void args.loadAdminTemplates();
  void args.loadStats();
}

export async function bulkReviewAdminTemplatesAction(args: {
  locale: string;
  confirmMessage: string;
  selectedIds: Set<number>;
  status: 'approved' | 'rejected';
  setSelectedAdminIds: AccountSelectionUpdater;
  loadAdminTemplates: AccountReloadFn;
  loadStats: AccountReloadFn;
  setBusy: (busy: boolean) => void;
}): Promise<void> {
  const ids = Array.from(args.selectedIds);
  if (!ids.length) return;
  if (!window.confirm(args.confirmMessage)) return;

  args.setBusy(true);
  try {
    await bulkReviewAdminTemplates(args.locale, ids, args.status);
    args.setSelectedAdminIds(() => new Set());
    void args.loadAdminTemplates();
    void args.loadStats();
  } finally {
    args.setBusy(false);
  }
}

export async function openAdminUserDetailAction(args: {
  locale: string;
  id: string;
  setDetailState: AccountDetailStateSetters;
}): Promise<void> {
  args.setDetailState.setOpen(true);
  args.setDetailState.setItem(null);
  args.setDetailState.setError(null);
  args.setDetailState.setLoading(true);
  try {
    const res = await loadAdminUserDetail(args.locale, args.id);
    if (res.item) {
      args.setDetailState.setItem(res.item);
    } else {
      args.setDetailState.setError(res.error ?? 'Load failed');
    }
  } catch (e: unknown) {
    args.setDetailState.setError(e instanceof Error ? e.message : 'Network error');
  } finally {
    args.setDetailState.setLoading(false);
  }
}