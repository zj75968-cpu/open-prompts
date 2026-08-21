import type { AdminTemplateRecord, TemplateRecord } from '~/lib/prompts/template-types';
import type { AdminUserDetail, AdminUserSummary } from '~/lib/users/admin-user-record';
import type { DailyCountPoint, AdminUserTrendRange } from '~/lib/users/admin-user-trend';
import type { PromptDetailItem } from '~/lib/prompts/prompt-model';
import type { ResolvedAccountPanel } from '~/lib/account/account-path';
import type { DisplayStatusKey } from './account-utils';

export type AccountPanel = ResolvedAccountPanel;

export type AccountUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
};

export type AccountProps = {
  locale: string;
  isAdmin: boolean;
  initialPanel: AccountPanel;
  user: AccountUser;
  initialAdmin?: {
    items: AdminTemplateRecord[];
    total: number | null;
    hasMore: boolean;
    pendingCount: number;
    promptsDailyTrend: DailyCountPoint[];
  } | null;
};

export type AccountDetailMeta = {
  statusKey: DisplayStatusKey;
  owner?: string | null;
  admin?: boolean;
  source?: TemplateRecord | AdminTemplateRecord;
};

export type AccountPageState = {
  detailOpen: boolean;
  detailItem: PromptDetailItem | null;
  detailMeta: AccountDetailMeta | null;
  userDetailOpen: boolean;
  userDetail: AdminUserDetail | null;
  userDetailLoading: boolean;
  userDetailError: string | null;
  userItems: AdminUserSummary[];
  usersSearch: string;
  usersPage: number;
  usersPageSize: number;
  usersTotal: number | null;
  usersPlatformTotal: number | null;
  usersActiveToday: number | null;
  usersNewToday: number | null;
  usersDailyTrend: DailyCountPoint[];
  usersTrendDays: AdminUserTrendRange;
};