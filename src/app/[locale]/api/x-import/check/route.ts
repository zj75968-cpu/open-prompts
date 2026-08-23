import { NextResponse } from 'next/server';
import type { XSourceCheckResponseDto } from '~/lib/x-import/x-import-dto';
import { getDb } from '~/db/client';
import { parseXStatusUrl } from '~/lib/x-import/parse-x-status-url';
import { findPromptByXStatusUrl } from '~/lib/x-import/x-source-duplicate';

export const dynamic = 'force-dynamic';

function sourceCheckResponse(body: XSourceCheckResponseDto) {
  return NextResponse.json(body);
}

function parseExcludeId(raw: string | null): number | undefined {
  if (!raw) return undefined;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : undefined;
}

export async function GET(req: Request) {
  const db = getDb();
  if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const url = new URL(req.url);
  const raw = url.searchParams.get('url')?.trim() ?? '';
  if (!raw) return sourceCheckResponse({ duplicate: null });

  if (!parseXStatusUrl(raw)) {
    return sourceCheckResponse({ duplicate: null, invalid: true });
  }

  const excludeId = parseExcludeId(url.searchParams.get('excludeId'));
  const duplicate = await findPromptByXStatusUrl(db, raw, { excludeId });
  return sourceCheckResponse({ duplicate });
}
