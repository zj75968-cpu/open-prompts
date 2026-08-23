import { NextResponse } from 'next/server';
import type {
  AccountTemplatesPageResponseDto,
  MyTemplatesQueryDto,
} from '~/lib/account/account-dto';
import type {
  PromptTemplateMutationResponseDto,
  PromptWriteRequestDto,
} from '~/lib/prompts/prompt-dto';
import { getDb } from '~/db/client';
import { requireAuthSession } from '~/lib/auth/session';
import { parseTemplateBody } from '~/lib/prompts/parse-template-body';
import {
  insertUserTemplate,
  listTemplates,
  parseReviewStatus,
  parseVisibility,
} from '~/lib/prompts/template-record';
import { checkXSourceDuplicate } from '~/lib/x-import/x-source-duplicate';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const session = await requireAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const url = new URL(req.url);
  const query: MyTemplatesQueryDto = {
    q: url.searchParams.get('q') ?? undefined,
    status: url.searchParams.get('status') ?? undefined,
    visibility: url.searchParams.get('visibility') ?? undefined,
    limit: Number(url.searchParams.get('limit') ?? 20),
    offset: Number(url.searchParams.get('offset') ?? 0),
  };
  const status = parseReviewStatus(query.status ?? '') ?? undefined;
  const visibility = parseVisibility(query.visibility ?? '') ?? undefined;

  try {
    const result = await listTemplates(db, {
      userId: session.user.id,
      q: query.q,
      status,
      visibility,
      limit: query.limit,
      offset: query.offset,
    });
    const response: AccountTemplatesPageResponseDto = result;
    return NextResponse.json(response);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'List failed';
    console.error('[my/templates GET]', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const session = await requireAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  let body: PromptWriteRequestDto;
  try {
    body = (await req.json()) as PromptWriteRequestDto;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = parseTemplateBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const v = parsed.value;
  try {
    const duplicate = await checkXSourceDuplicate(db, v.sourceUrl);
    if (duplicate) {
      return NextResponse.json({ error: 'duplicate_x_source', duplicate }, { status: 409 });
    }
    const item = await insertUserTemplate(db, session.user.id, {
      title: v.title,
      description: v.description,
      prompt: v.prompt,
      modelLabel: v.modelLabel,
      category: v.category,
      tags: v.tags,
      images: v.images,
      visibility: v.visibility,
      sourceUrl: v.sourceUrl,
      authorHandle: v.authorHandle,
    });
    const response: PromptTemplateMutationResponseDto = { ok: true, item };
    return NextResponse.json(response);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Create failed';
    console.error('[my/templates POST]', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
