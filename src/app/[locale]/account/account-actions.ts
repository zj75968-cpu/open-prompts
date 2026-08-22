import {
  bulkDeleteMyTemplates,
  bulkReviewAdminTemplates,
  deleteMyTemplate,
  reviewAdminTemplate,
} from './account-api';

export type AccountTranslateFn = (key: string, values?: Record<string, unknown>) => string;

export type AccountSelectionUpdater = (updater: (prev: Set<number>) => Set<number>) => void;

export type AccountReloadFn = () => void;

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
  refreshOverview: AccountReloadFn;
}): Promise<void> {
  if (!window.confirm(args.confirmMessage)) return;
  await deleteMyTemplate(args.locale, args.id);
  args.setSelectedMyIds((prev) => removeSelectedId(prev, args.id));
  args.resetPrefetch();
  void args.loadMyTemplates();
  args.refreshOverview();
}

export async function bulkDeleteMyTemplatesAction(args: {
  locale: string;
  confirmMessage: string;
  selectedIds: Set<number>;
  setSelectedMyIds: AccountSelectionUpdater;
  resetPrefetch: () => void;
  loadMyTemplates: AccountReloadFn;
  refreshOverview: AccountReloadFn;
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
    args.refreshOverview();
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
  refreshOverview: AccountReloadFn;
}): Promise<void> {
  await reviewAdminTemplate(args.locale, args.id, args.status);
  args.setSelectedAdminIds((prev) => removeSelectedId(prev, args.id));
  void args.loadAdminTemplates();
  args.refreshOverview();
}

export async function bulkReviewAdminTemplatesAction(args: {
  locale: string;
  confirmMessage: string;
  selectedIds: Set<number>;
  status: 'approved' | 'rejected';
  setSelectedAdminIds: AccountSelectionUpdater;
  loadAdminTemplates: AccountReloadFn;
  refreshOverview: AccountReloadFn;
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
    args.refreshOverview();
  } finally {
    args.setBusy(false);
  }
}
