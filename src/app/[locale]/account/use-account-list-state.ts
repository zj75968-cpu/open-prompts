import { useEffect, useState } from 'react';
import type { AdminUserTrendRange } from '~/lib/users/admin-user-trend';

export function useAccountListState() {
  const [myPage, setMyPage] = useState(1);
  const [myPageSize, setMyPageSize] = useState(20);
  const [search, setSearch] = useState('');
  const [myStatusFilter, setMyStatusFilter] = useState('');
  const [selectedMyIds, setSelectedMyIds] = useState<Set<number>>(() => new Set());

  const [adminSearch, setAdminSearch] = useState('');
  const [adminStatusFilter, setAdminStatusFilter] = useState('');
  const [adminPage, setAdminPage] = useState(1);
  const [adminPageSize, setAdminPageSize] = useState(20);
  const [selectedAdminIds, setSelectedAdminIds] = useState<Set<number>>(() => new Set());

  const [usersSearch, setUsersSearch] = useState('');
  const [usersPage, setUsersPage] = useState(1);
  const [usersPageSize, setUsersPageSize] = useState(20);
  const [usersTrendDays, setUsersTrendDays] = useState<AdminUserTrendRange>(30);
  const [adminTrendDays, setAdminTrendDays] = useState<AdminUserTrendRange>(30);

  useEffect(() => {
    setMyPage(1);
    setSelectedMyIds(new Set());
  }, [search, myStatusFilter, myPageSize]);

  useEffect(() => {
    setSelectedMyIds(new Set());
  }, [myPage]);

  useEffect(() => {
    setAdminPage(1);
    setSelectedAdminIds(new Set());
  }, [adminSearch, adminStatusFilter, adminPageSize, adminTrendDays]);

  useEffect(() => {
    setSelectedAdminIds(new Set());
  }, [adminPage]);

  useEffect(() => {
    setUsersPage(1);
  }, [usersSearch, usersPageSize, usersTrendDays]);

  return {
    adminPage,
    adminPageSize,
    adminSearch,
    adminStatusFilter,
    adminTrendDays,
    myPage,
    myPageSize,
    myStatusFilter,
    search,
    selectedAdminIds,
    selectedMyIds,
    setAdminPage,
    setAdminPageSize,
    setAdminSearch,
    setAdminStatusFilter,
    setAdminTrendDays,
    setMyPage,
    setMyPageSize,
    setMyStatusFilter,
    setSearch,
    setSelectedAdminIds,
    setSelectedMyIds,
    setUsersPage,
    setUsersPageSize,
    setUsersSearch,
    setUsersTrendDays,
    usersPage,
    usersPageSize,
    usersSearch,
    usersTrendDays,
  };
}