'use client';

import type { AdminUserTrendRange } from '~/lib/users/admin-user-trend';
import {
  type AccountSelectionUpdater,
  type AccountTranslateFn,
} from './account-actions';
import type { AccountPanel } from './account-types';
import {
  useAdminTemplatesContent,
  type AdminTemplatesContentState,
  type InitialAdminTemplates,
} from './use-admin-templates-content';
import {
  useAdminUsersContent,
  type AdminUsersContentState,
} from './use-admin-users-content';
import {
  useMyTemplatesContent,
  type MyTemplatesContentState,
} from './use-my-templates-content';

export type AccountContentState = MyTemplatesContentState &
  AdminTemplatesContentState &
  AdminUsersContentState;

export type UseAccountContentStateArgs = {
  locale: string;
  isAdmin: boolean;
  panel: AccountPanel;
  userEmail: string;
  t: AccountTranslateFn;
  initialAdmin?: InitialAdminTemplates | null;
  search: string;
  myStatusFilter: string;
  myPage: number;
  myPageSize: number;
  adminSearch: string;
  adminStatusFilter: string;
  adminPage: number;
  adminPageSize: number;
  adminTrendDays: AdminUserTrendRange;
  usersSearch: string;
  usersPage: number;
  usersPageSize: number;
  usersTrendDays: AdminUserTrendRange;
  selectedMyIds: Set<number>;
  setSelectedMyIds: AccountSelectionUpdater;
  selectedAdminIds: Set<number>;
  setSelectedAdminIds: AccountSelectionUpdater;
};

/**
 * Account page composition root. Domain state and side effects live in the
 * focused hooks below; this hook only wires their cross-domain refreshes.
 */
export function useAccountContentState(
  args: UseAccountContentStateArgs,
): AccountContentState {
  const myTemplates = useMyTemplatesContent({
    locale: args.locale,
    panel: args.panel,
    t: args.t,
    query: {
      search: args.search,
      statusFilter: args.myStatusFilter,
      page: args.myPage,
      pageSize: args.myPageSize,
    },
    selection: {
      selectedIds: args.selectedMyIds,
      setSelectedIds: args.setSelectedMyIds,
    },
  });

  const adminTemplates = useAdminTemplatesContent({
    locale: args.locale,
    isAdmin: args.isAdmin,
    panel: args.panel,
    userEmail: args.userEmail,
    t: args.t,
    initial: args.initialAdmin,
    query: {
      search: args.adminSearch,
      statusFilter: args.adminStatusFilter,
      page: args.adminPage,
      pageSize: args.adminPageSize,
      trendDays: args.adminTrendDays,
    },
    selection: {
      selectedIds: args.selectedAdminIds,
      setSelectedIds: args.setSelectedAdminIds,
    },
    refreshOverview: myTemplates.loadStats,
  });

  const adminUsers = useAdminUsersContent({
    locale: args.locale,
    isAdmin: args.isAdmin,
    panel: args.panel,
    t: args.t,
    query: {
      search: args.usersSearch,
      page: args.usersPage,
      pageSize: args.usersPageSize,
      trendDays: args.usersTrendDays,
    },
  });

  return {
    ...myTemplates,
    ...adminTemplates,
    ...adminUsers,
  };
}