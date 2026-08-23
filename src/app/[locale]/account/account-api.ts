import {
  getAdminTemplatesPage,
  getAdminUser,
  getAdminUsersPage,
  getMyTemplatesPage,
  getMyTemplateStats,
  removeMyTemplate,
  removeMyTemplates,
  reviewTemplate,
  reviewTemplates,
} from '~/lib/account/account-api-client';
import {
  isAccountApiErrorResponse,
  type AdminUsersPageResponseDto,
} from '~/lib/account/account-dto';
import {
  parseMyTemplatesPage,
  type MyTemplatesPage,
} from '~/lib/account/my-templates-page';
import type {
  AdminTemplateRecord,
  TemplateRecord,
} from '~/lib/prompts/template-types';
import type {
  AdminUserDetail,
  AdminUserSummary,
} from '~/lib/users/admin-user-record';
import {
  normalizeTrendDays,
  type DailyCountPoint,
} from '~/lib/users/admin-user-trend';

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

export async function loadMyTemplatesStats(
  locale: string,
): Promise<MyTemplatesStats> {
  const response = await getMyTemplateStats(locale);
  if (!response.ok || isAccountApiErrorResponse(response.data)) {
    return { templateCount: null, pendingCount: null };
  }
  return {
    templateCount: response.data.templateCount,
    pendingCount: response.data.pendingCount,
  };
}

export async function loadMyTemplatesPage(
  locale: string,
  params: {
    search: string;
    statusFilter: string;
    page: number;
    pageSize: number;
    signal?: AbortSignal;
  },
): Promise<{ ok: boolean; status: number; page: MyTemplatesPage }> {
  const response = await getMyTemplatesPage(
    locale,
    {
      q: params.search,
      status: params.statusFilter || undefined,
      limit: params.pageSize,
      offset: (params.page - 1) * params.pageSize,
    },
    params.signal,
  );
  const data = isAccountApiErrorResponse(response.data)
    ? { items: [] as TemplateRecord[], total: 0, offset: 0 }
    : response.data;
  return {
    ok: response.ok,
    status: response.status,
    page: parseMyTemplatesPage(data, params.page, params.pageSize),
  };
}

export async function loadAdminTemplatesPage(
  locale: string,
  params: {
    search: string;
    statusFilter: string;
    page: number;
    pageSize: number;
    trendDays: number;
    signal?: AbortSignal;
  },
): Promise<{ ok: boolean; status: number; data: AdminTemplatesPageData }> {
  const response = await getAdminTemplatesPage(
    locale,
    {
      q: params.search,
      status: params.statusFilter || undefined,
      limit: params.pageSize,
      offset: (params.page - 1) * params.pageSize,
      trendDays: normalizeTrendDays(params.trendDays),
    },
    params.signal,
  );
  const data = isAccountApiErrorResponse(response.data) ? null : response.data;
  return {
    ok: response.ok,
    status: response.status,
    data: {
      items: data?.items ?? [],
      total: data?.total ?? null,
      hasMore: data?.hasMore ?? false,
      pendingCount: data?.pendingCount ?? null,
      promptsDailyTrend: data?.promptsDailyTrend ?? [],
    },
  };
}

export async function loadAdminTemplatesBadge(
  locale: string,
): Promise<number | null> {
  const response = await getAdminTemplatesPage(locale, { limit: 1 });
  return response.ok && !isAccountApiErrorResponse(response.data)
    ? response.data.pendingCount
    : null;
}

export async function loadAdminUsersPage(
  locale: string,
  params: {
    search: string;
    page: number;
    pageSize: number;
    trendDays: number;
    signal?: AbortSignal;
  },
): Promise<{
  ok: boolean;
  status: number;
  data: AdminUsersPageData;
  error?: string;
}> {
  const response = await getAdminUsersPage(
    locale,
    {
      q: params.search,
      limit: params.pageSize,
      offset: (params.page - 1) * params.pageSize,
      trendDays: normalizeTrendDays(params.trendDays),
    },
    params.signal,
  );
  let data: AdminUsersPageResponseDto | null;
  let error: string | undefined;
  if (isAccountApiErrorResponse(response.data)) {
    data = null;
    error = response.data.error;
  } else {
    data = response.data;
    error = undefined;
  }
  return {
    ok: response.ok,
    status: response.status,
    error,
    data: {
      items: data?.items ?? [],
      total: data?.total ?? null,
      hasMore: data?.hasMore ?? false,
      stats: data
        ? {
            totalUsers: data.stats.totalUsers,
            activeToday: data.stats.activeToday,
            newToday: data.stats.newToday,
            usersDailyTrend: data.stats.usersDailyTrend,
          }
        : null,
    },
  };
}

export async function loadAdminUserDetail(
  locale: string,
  id: string,
): Promise<AdminUserDetailData> {
  const response = await getAdminUser(locale, id);
  if (isAccountApiErrorResponse(response.data)) {
    return { item: null, error: response.data.error };
  }
  return {
    item: response.ok ? response.data.item : null,
  };
}

export async function deleteMyTemplate(
  locale: string,
  id: number,
): Promise<{ ok: boolean; status: number }> {
  const response = await removeMyTemplate(locale, id);
  return { ok: response.ok, status: response.status };
}

export async function bulkDeleteMyTemplates(
  locale: string,
  ids: number[],
): Promise<{ ok: boolean; status: number }> {
  const response = await removeMyTemplates(locale, ids);
  return { ok: response.ok, status: response.status };
}

export async function reviewAdminTemplate(
  locale: string,
  id: number,
  status: 'approved' | 'rejected',
): Promise<{ ok: boolean; status: number }> {
  const response = await reviewTemplate(locale, id, status);
  return { ok: response.ok, status: response.status };
}

export async function bulkReviewAdminTemplates(
  locale: string,
  ids: number[],
  status: 'approved' | 'rejected',
): Promise<{ ok: boolean; status: number }> {
  const response = await reviewTemplates(locale, ids, status);
  return { ok: response.ok, status: response.status };
}