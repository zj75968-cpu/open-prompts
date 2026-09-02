import { NextResponse } from 'next/server';
import { getDb } from '~/db/client';
import { requireAdminSession } from '~/lib/auth/session';
import { cleanupStaleImageAssets } from '~/lib/assets/asset-service';
import { ImageAssetConfigurationError } from '~/lib/assets/cloudflare-r2';

export const dynamic = 'force-dynamic';

function integerParam(value: string | null, fallback: number): number {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.floor(parsed) : fallback;
}

function constantTimeEqual(left: string, right: string): boolean {
  const maxLength = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < maxLength; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function hasCleanupSecret(req: Request): boolean {
  const configured = String(process.env.ASSET_CLEANUP_SECRET || '').trim();
  if (!configured) return false;
  const authorization = String(req.headers.get('authorization') || '').trim();
  const provided = /^Bearer\s+(.+)$/i.exec(authorization)?.[1]?.trim() || '';
  return Boolean(provided) && constantTimeEqual(provided, configured);
}

export async function POST(req: Request) {
  if (!hasCleanupSecret(req)) {
    const session = await requireAdminSession();
    if (!session) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const db = getDb();
  if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const url = new URL(req.url);
  const olderThanHours = Math.max(24, Math.min(integerParam(url.searchParams.get('olderThanHours'), 24), 24 * 90));
  const limit = Math.max(1, Math.min(integerParam(url.searchParams.get('limit'), 100), 500));

  try {
    const result = await cleanupStaleImageAssets({
      db,
      olderThan: new Date(Date.now() - olderThanHours * 60 * 60 * 1_000),
      limit,
    });
    return NextResponse.json({ ok: true, olderThanHours, ...result });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Image asset cleanup failed.';
    console.error('[assets cleanup POST]', { error: message });
    return NextResponse.json(
      { error: message },
      { status: error instanceof ImageAssetConfigurationError ? 503 : 500 },
    );
  }
}