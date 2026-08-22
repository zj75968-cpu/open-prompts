import type { AdminTemplateRecord } from '~/lib/prompts/template-types';
import type { DailyCountPoint } from '~/lib/users/admin-user-trend';
import type { ResolvedAccountPanel } from '~/lib/account/account-path';

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
