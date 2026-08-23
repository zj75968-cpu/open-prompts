import { NextResponse } from 'next/server';
import type {
  AccountTemplateResponseDto,
  AdminTemplateReviewRequestDto,
  AdminTemplateReviewResponseDto,
} from '~/lib/account/account-dto';
import { getDb } from '~/db/client';
import { requireAdminSession } from '~/lib/auth/session';
import { adminSetReviewStatus, getTemplateById, parseReviewStatus } from '~/lib/prompts/template-record';

export const dynamic = 'force-dynamic';

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getDb();
  if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const { id: raw } = await params;
  const id = parseId(raw);
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  let body: Partial<AdminTemplateReviewRequestDto>;
  try {
    body = (await req.json()) as Partial<AdminTemplateReviewRequestDto>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const status = parseReviewStatus(body.status);
  if (!status || (status !== 'approved' && status !== 'rejected')) {
    return NextResponse.json({ error: 'status must be approved or rejected' }, { status: 400 });
  }

  try {
    const item = await adminSetReviewStatus(db, id, status);
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const response: AdminTemplateReviewResponseDto = { ok: true, item };
    return NextResponse.json(response);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Update failed';
    console.error('[admin/templates PATCH]', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAdminSession();
  if (!session) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getDb();
  if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const { id: raw } = await params;
  const id = parseId(raw);
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const item = await getTemplateById(db, id);
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const response: AccountTemplateResponseDto = { item };
  return NextResponse.json(response);
}
