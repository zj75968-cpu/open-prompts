import { NextResponse } from 'next/server';
import type {
  AdminTemplatesPageResponseDto,
  AdminTemplatesQueryDto,
} from '~/lib/account/account-dto';
import { getDb } from '~/db/client';
import { requireAdminSession } from '~/lib/auth/session';
import {
  countPendingReview,
  listTemplatesForAdmin,
  parseReviewStatus,
  parseVisibility,
} from '~/lib/prompts/template-record';
import { getPromptDailyTrend } from '~/lib/users/admin-user-record';
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
  const query: AdminTemplatesQueryDto = {
    q: url.searchParams.get('q') ?? undefined,
    status: url.searchParams.get('status') ?? undefined,
    visibility: url.searchParams.get('visibility') ?? undefined,
    limit: Number(url.searchParams.get('limit') ?? 50),
    offset: Number(url.searchParams.get('offset') ?? 0),
    trendDays: normalizeTrendDays(url.searchParams.get('trendDays')),
  };
  const status = parseReviewStatus(query.status ?? '') ?? undefined;
  const visibility = parseVisibility(query.visibility ?? '') ?? undefined;
  const trendDays = query.trendDays ?? 30;

  try {
    const [result, pendingCount] = await Promise.all([
      listTemplatesForAdmin(db, {
        q: query.q,
        status,
        visibility,
        limit: query.limit,
        offset: query.offset,
      }),
      countPendingReview(db),
    ]);
    let promptsDailyTrend: Awaited<ReturnType<typeof getPromptDailyTrend>> = [];
    try {
      promptsDailyTrend = await getPromptDailyTrend(db, trendDays);
    } catch (trendErr) {
      console.error('[admin/templates GET:trend]', trendErr);
    }
    const response: AdminTemplatesPageResponseDto = {
      ...result,
      pendingCount,
      trendDays,
      promptsDailyTrend,
    };
    return NextResponse.json(response);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'List failed';
    console.error('[admin/templates GET]', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
