import { NextResponse } from 'next/server';
import type {
  AdminUsersPageResponseDto,
  AdminUsersQueryDto,
} from '~/lib/account/account-dto';
import { getDb } from '~/db/client';
import { requireAdminSession } from '~/lib/auth/session';
import { listUsers, getAdminUserStats } from '~/lib/users/admin-user-record';
import { normalizeTrendDays } from '~/lib/users/admin-user-trend';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getDb();
  if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const url = new URL(req.url);
  const query: AdminUsersQueryDto = {
    q: url.searchParams.get('q') ?? undefined,
    limit: Number(url.searchParams.get('limit') ?? 20),
    offset: Number(url.searchParams.get('offset') ?? 0),
    trendDays: normalizeTrendDays(url.searchParams.get('trendDays')),
  };
  const trendDays = query.trendDays ?? 30;

  try {
    const result = await listUsers(db, {
      q: query.q,
      limit: query.limit,
      offset: query.offset,
    });

    let userStats: Awaited<ReturnType<typeof getAdminUserStats>> = {
      totalUsers: 0,
      activeToday: 0,
      newToday: 0,
      trendDays,
      usersDailyTrend: [],
    };
    try {
      userStats = await getAdminUserStats(db, trendDays);
    } catch (statsErr) {
      console.error('[admin/users GET] stats failed', statsErr);
    }

    const response: AdminUsersPageResponseDto = {
      ...result,
      stats: userStats,
    };
    return NextResponse.json(response);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'List failed';
    console.error('[admin/users GET]', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
