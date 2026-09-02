import type {
  AccountApiResponseDto,
  AccountDeleteResponseDto,
  AccountTemplateResponseDto,
  AccountTemplatesPageResponseDto,
  AdminTemplateReviewRequestDto,
  AdminTemplateReviewResponseDto,
  AdminTemplatesBulkReviewRequestDto,
  AdminTemplatesBulkReviewResponseDto,
  AdminTemplatesPageResponseDto,
  AdminTemplatesQueryDto,
  AdminUserResponseDto,
  AdminUsersPageResponseDto,
  AdminUsersQueryDto,
  MyTemplateStatsResponseDto,
  MyTemplatesBulkDeleteRequestDto,
  MyTemplatesBulkDeleteResponseDto,
  MyTemplatesQueryDto,
} from '~/lib/account/account-dto';
import { requestJson, type JsonResponse } from '~/lib/api/json-client';
import { localeApiPath } from '~/lib/locale-api-path';

function queryString(
  entries: ReadonlyArray<readonly [string, string | number | undefined]>,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of entries) {
    if (value !== undefined && value !== '') query.set(key, String(value));
  }
  const value = query.toString();
  return value ? `?${value}` : '';
}

function templatesQuery(query: MyTemplatesQueryDto): string {
  return queryString([
    ['q', query.q?.trim()],
    ['status', query.status],
    ['visibility', query.visibility],
    ['limit', query.limit],
    ['offset', query.offset],
  ]);
}

function adminTemplatesQuery(query: AdminTemplatesQueryDto): string {
  return queryString([
    ['q', query.q?.trim()],
    ['status', query.status],
    ['visibility', query.visibility],
    ['limit', query.limit],
    ['offset', query.offset],
    ['trendDays', query.trendDays],
  ]);
}

function adminUsersQuery(query: AdminUsersQueryDto): string {
  return queryString([
    ['q', query.q?.trim()],
    ['limit', query.limit],
    ['offset', query.offset],
    ['trendDays', query.trendDays],
  ]);
}

export function getMyTemplateStats(
  locale: string,
): Promise<JsonResponse<AccountApiResponseDto<MyTemplateStatsResponseDto>>> {
  return requestJson(localeApiPath(locale, '/api/my/templates/stats'), {
    cache: 'no-store',
  });
}

export function getMyTemplatesPage(
  locale: string,
  query: MyTemplatesQueryDto,
  signal?: AbortSignal,
): Promise<
  JsonResponse<AccountApiResponseDto<AccountTemplatesPageResponseDto>>
> {
  return requestJson(
    localeApiPath(locale, `/api/my/templates${templatesQuery(query)}`),
    { cache: 'no-store', signal },
  );
}

export function getAdminTemplatesPage(
  locale: string,
  query: AdminTemplatesQueryDto,
  signal?: AbortSignal,
): Promise<
  JsonResponse<AccountApiResponseDto<AdminTemplatesPageResponseDto>>
> {
  return requestJson(
    localeApiPath(
      locale,
      `/api/admin/templates${adminTemplatesQuery(query)}`,
    ),
    { cache: 'no-store', signal },
  );
}

export function getAdminTemplate(
  locale: string,
  id: number,
): Promise<JsonResponse<AccountApiResponseDto<AccountTemplateResponseDto>>> {
  return requestJson(
    localeApiPath(locale, `/api/admin/templates/${id}`),
    { cache: 'no-store' },
  );
}

export function getAdminUsersPage(
  locale: string,
  query: AdminUsersQueryDto,
  signal?: AbortSignal,
): Promise<JsonResponse<AccountApiResponseDto<AdminUsersPageResponseDto>>> {
  return requestJson(
    localeApiPath(locale, `/api/admin/users${adminUsersQuery(query)}`),
    { cache: 'no-store', signal },
  );
}

export function getAdminUser(
  locale: string,
  id: string,
): Promise<JsonResponse<AccountApiResponseDto<AdminUserResponseDto>>> {
  return requestJson(
    localeApiPath(locale, `/api/admin/users/${encodeURIComponent(id)}`),
    { cache: 'no-store' },
  );
}

export function removeMyTemplate(
  locale: string,
  id: number,
): Promise<JsonResponse<AccountApiResponseDto<AccountDeleteResponseDto>>> {
  return requestJson(localeApiPath(locale, `/api/my/templates/${id}`), {
    method: 'DELETE',
  });
}

export function removeMyTemplates(
  locale: string,
  ids: number[],
): Promise<
  JsonResponse<AccountApiResponseDto<MyTemplatesBulkDeleteResponseDto>>
> {
  const body: MyTemplatesBulkDeleteRequestDto = { ids };
  return requestJson<
    AccountApiResponseDto<MyTemplatesBulkDeleteResponseDto>,
    MyTemplatesBulkDeleteRequestDto
  >(localeApiPath(locale, '/api/my/templates/bulk'), {
    method: 'DELETE',
    body,
  });
}

export function reviewTemplate(
  locale: string,
  id: number,
  status: AdminTemplateReviewRequestDto['status'],
): Promise<
  JsonResponse<AccountApiResponseDto<AdminTemplateReviewResponseDto>>
> {
  const body: AdminTemplateReviewRequestDto = { status };
  return requestJson<
    AccountApiResponseDto<AdminTemplateReviewResponseDto>,
    AdminTemplateReviewRequestDto
  >(localeApiPath(locale, `/api/admin/templates/${id}`), {
    method: 'PATCH',
    body,
  });
}

export function reviewTemplates(
  locale: string,
  ids: number[],
  status: AdminTemplatesBulkReviewRequestDto['status'],
): Promise<
  JsonResponse<AccountApiResponseDto<AdminTemplatesBulkReviewResponseDto>>
> {
  const body: AdminTemplatesBulkReviewRequestDto = { ids, status };
  return requestJson<
    AccountApiResponseDto<AdminTemplatesBulkReviewResponseDto>,
    AdminTemplatesBulkReviewRequestDto
  >(localeApiPath(locale, '/api/admin/templates/bulk'), {
    method: 'PATCH',
    body,
  });
}