import { NextResponse } from 'next/server';
import type { MyTemplateStatsResponseDto } from '~/lib/account/account-dto';
import { getDb } from '~/db/client';
import { requireAuthSession } from '~/lib/auth/session';
import { countUserPendingReview, countUserTemplates } from '~/lib/prompts/template-record';

export const dynamic = 'force-dynamic';

export async function GET() {
  const session = await requireAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  try {
    const templateCount = await countUserTemplates(db, session.user.id);
    const pendingCount = await countUserPendingReview(db, session.user.id);
    const response: MyTemplateStatsResponseDto = {
      templateCount,
      pendingCount,
    };
    return NextResponse.json(response);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Stats failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
