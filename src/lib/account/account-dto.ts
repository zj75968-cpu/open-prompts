import type {
  AdminTemplateSummary,
  TemplateRecord,
} from '~/lib/prompts/template-types';
import type {
  AdminUserDetail,
  AdminUserStats,
  AdminUserSummary,
} from '~/lib/users/admin-user-record';
import type {
  AdminUserTrendRange,
  DailyCountPoint,
} from '~/lib/users/admin-user-trend';

export type AccountPageQueryDto = {
  q?: string;
  limit?: number;
  offset?: number;
};

export type MyTemplatesQueryDto = AccountPageQueryDto & {
  status?: string;
  visibility?: string;
};

export type AdminTemplatesQueryDto = MyTemplatesQueryDto & {
  trendDays?: AdminUserTrendRange;
};

export type AdminUsersQueryDto = AccountPageQueryDto & {
  trendDays?: AdminUserTrendRange;
};

export type AccountTemplatesPageResponseDto = {
  items: TemplateRecord[];
  total: number;
  limit: number;
  offset: number;
};

export type AdminTemplatesPageResponseDto = {
  items: AdminTemplateSummary[];
  total: number | null;
  limit: number;
  offset: number;
  hasMore: boolean;
  pendingCount: number;
  trendDays: AdminUserTrendRange;
  promptsDailyTrend: DailyCountPoint[];
};

export type MyTemplateStatsResponseDto = {
  templateCount: number;
  pendingCount: number;
};

export type AccountTemplateResponseDto = {
  item: TemplateRecord;
};

export type AccountDeleteResponseDto = {
  ok: true;
};

export type MyTemplatesBulkDeleteRequestDto = {
  ids: number[];
};

export type MyTemplatesBulkDeleteResponseDto = {
  ok: true;
  deleted: number;
};

export type AdminTemplateReviewStatusDto = 'approved' | 'rejected';

export type AdminTemplateReviewRequestDto = {
  status: AdminTemplateReviewStatusDto;
};

export type AdminTemplatesBulkReviewRequestDto = {
  ids: number[];
  status: AdminTemplateReviewStatusDto;
};

export type AdminTemplateReviewResponseDto = {
  ok: true;
  id: number;
  status: AdminTemplateReviewStatusDto;
};

export type AdminTemplatesBulkReviewResponseDto = {
  ok: true;
  updated: number;
};

export type AdminUsersPageResponseDto = {
  items: AdminUserSummary[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
  stats: AdminUserStats;
};

export type AdminUserResponseDto = {
  item: AdminUserDetail;
};

export type AccountApiErrorResponseDto = {
  error: string;
};

export type AccountApiResponseDto<T> = T | AccountApiErrorResponseDto;

export function isAccountApiErrorResponse(
  value: AccountApiResponseDto<unknown>,
): value is AccountApiErrorResponseDto {
  return typeof value === 'object' && value !== null && 'error' in value;
}