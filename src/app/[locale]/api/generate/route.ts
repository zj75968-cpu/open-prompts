import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST() {
  return NextResponse.json(
    {
      error: 'This legacy generation endpoint is disabled.',
      hint: 'Use POST /api/generations so successful image outputs are persisted to Cloudflare R2.',
    },
    { status: 410 },
  );
}
