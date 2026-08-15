import { localeApiPath } from '~/lib/locale-api-path';
import type { AdminTemplateRecord, TemplateRecord } from '~/lib/prompts/template-types';
import type { AdminUserDetail, AdminUserSummary } from '~/lib/users/admin-user-record';
import type { DailyCountPoint } from '~/lib/users/admin-user-trend';
import { buildMyTemplatesQuery, parseMyTemplatesPage, type MyTemplatesPage } from '~/lib/account/my-templates-page';
import { parseAdminUserStats } from './account-utils';

async function readJson<T>(res: Response): Promise<T> {
  return (await res.json().catch(() => ({}))) as T;
}

async function fetchJson<T>(
  url: string,
  init: RequestInit = {},
): Promise<{ ok: boolean; status: number; data: T }> {
  const res = await fetch(url, init);
  return {
    ok: res.ok,
    status: res.status,
    data: await readJson<T>(res),
  };
}

export type MyTemplatesStats = {
  templateCount: number | null;
  pendingCount: number | null;
};

export type AdminTemplatesPageData = {
  items: AdminTemplateRecord[];
  total: number | null;
  hasMore: boolean;
  pendingCount: number | null;
  promptsDailyTrend: DailyCountPoint[];
};

export type AdminUsersPageData = {
  items: AdminUserSummary[];
  total: number | null;
  hasMore: boolean;
  stats: {
    totalUsers: number;
    activeToday: number;
    newToday: number;
    usersDailyTrend: DailyCountPoint[];
  } | null;
};

export type AdminUserDetailData = {
  item: AdminUserDetail | null;
  error?: string;
};

export async function loadMyTemplatesStats(locale: string): Promise<MyTemplatesStats> {
  const res = await fetchJson<{ templateCount?: number; pendingCount?: number }>(
    localeApiPath(locale, '/api/my/templates/stats'),
    { cache: 'no-store' },
  );
  if (!res.ok) {
    return { templateCount: null, pendingCount: null };
  }
  return {
    templateCount: typeof res.data.templateCount === 'number' ? res.data.templateCount : 0,
    pendingCount: typeof res.data.pendingCount === 'number' ? res.data.pendingCount : 0,
  };
}

export async function loadMyTemplatesPage(locale: string, params: {
  search: string;
  statusFilter: string;
  page: number;
  pageSize: number;
  signal?: AbortSignal;
}): Promise<{ ok: boolean; status: number; page: MyTemplatesPage }> {
  const q = buildMyTemplatesQuery(params.search, params.statusFilter, params.page, params.pageSize);
  const res = await fetchJson<{ items?: TemplateRecord[]; total?: number; offset?: number }>(
    localeApiPath(locale, `/api/my/templates?${q}`),
    { cache: 'no-store', signal: params.signal },
  );
  return {
    ok: res.ok,
    status: res.status,
    page: parseMyTemplatesPage(res.data, params.page, params.pageSize),
  };
}

export async function loadAdminTemplatesPage(locale: string, params: {
  search: string;
  statusFilter: string;
  page: number;
  pageSize: number;
  trendDays: number;
  signal?: AbortSignal;
}): Promise<{ ok: boolean; status: number; data: AdminTemplatesPageData }> {
  const q = new URLSearchParams();
  if (params.search.trim()) q.set('q', params.search.trim());
  if (params.statusFilter) q.set('status', params.statusFilter);
  q.set('limit', String(params.pageSize));
  q.set('offset', String((params.page - 1) * params.pageSize));
  q.set('trendDays', String(params.trendDays));

  const res = await fetchJson<{
    items?: AdminTemplateRecord[];
    total?: number | null;
    hasMore?: boolean;
    pendingCount?: number;
    promptsDailyTrend?: DailyCountPoint[];
    error?: string;
  }>(localeApiPath(locale, `/api/admin/templates?${q}`), {
    cache: 'no-store',
    signal: params.signal,
  });

  return {
    ok: res.ok,
    status: res.status,
    data: {
      items: res.data.items ?? [],
      total: typeof res.data.total === 'number' ? res.data.total : null,
      hasMore: Boolean(res.data.hasMore),
      pendingCount: typeof res.data.pendingCount === 'number' ? res.data.pendingCount : null,
      promptsDailyTrend: Array.isArray(res.data.promptsDailyTrend) ? res.data.promptsDailyTrend : [],
    },
  };
}

export async function loadAdminTemplatesBadge(locale: string): Promise<number | null> {
  const res = await fetchJson<{ pendingCount?: number }>(
    localeApiPath(locale, '/api/admin/templates?limit=1'),
    { cache: 'no-store' },
  );
  return res.ok && typeof res.data.pendingCount === 'number' ? res.data.pendingCount : null;
}

export async function loadAdminUsersPage(locale: string, params: {
  search: string;
  page: number;
  pageSize: number;
  trendDays: number;
  signal?: AbortSignal;
}): Promise<{ ok: boolean; status: number; data: AdminUsersPageData; error?: string }> {
  const q = new URLSearchParams();
  if (params.search.trim()) q.set('q', params.search.trim());
  q.set('limit', String(params.pageSize));
  q.set('offset', String((params.page - 1) * params.pageSize));
  q.set('trendDays', String(params.trendDays));

  const res = await fetchJson<Record<string, unknown> & {
    items?: AdminUserSummary[];
    total?: number;
    hasMore?: boolean;
    error?: string;
    stats?: Record<string, unknown>;
  }>(localeApiPath(locale, `/api/admin/users?${q}`), {
    cache: 'no-store',
    signal: params.signal,
  });

  const stats = parseAdminUserStats(res.data);
  return {
    ok: res.ok,
    status: res.status,
    error: res.data.error,
    data: {
      items: res.data.items ?? [],
      total: typeof res.data.total === 'number' ? res.data.total : null,
      hasMore: Boolean(res.data.hasMore),
      stats,
    },
  };
}

export async function loadAdminUserDetail(locale: string, id: string): Promise<AdminUserDetailData> {
  const res = await fetchJson<{ item?: AdminUserDetail; error?: string }>(
    localeApiPath(locale, `/api/admin/users/${id}`),
    { cache: 'no-store' },
  );
  return {
    item: res.ok ? res.data.item ?? null : null,
    error: res.data.error,
  };
}

export async function deleteMyTemplate(locale: string, id: number): Promise<{ ok: boolean; status: number }> {
  const res = await fetchJson<unknown>(localeApiPath(locale, `/api/my/templates/${id}`), {
    method: 'DELETE',
  });
  return { ok: res.ok, status: res.status };
}

export async function bulkDeleteMyTemplates(locale: string, ids: number[]): Promise<{ ok: boolean; status: number }> {
  const res = await fetchJson<unknown>(localeApiPath(locale, '/api/my/templates/bulk'), {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids }),
  });
  return { ok: res.ok, status: res.status };
}

export async function reviewAdminTemplate(
  locale: string,
  id: number,
  status: 'approved' | 'rejected',
): Promise<{ ok: boolean; status: number }> {
  const res = await fetchJson<unknown>(localeApiPath(locale, `/api/admin/templates/${id}`), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  });
  return { ok: res.ok, status: res.status };
}

export async function bulkReviewAdminTemplates(
  locale: string,
  ids: number[],
  status: 'approved' | 'rejected',
): Promise<{ ok: boolean; status: number }> {
  const res = await fetchJson<unknown>(localeApiPath(locale, '/api/admin/templates/bulk'), {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ids, status }),
  });
  return { ok: res.ok, status: res.status };
}