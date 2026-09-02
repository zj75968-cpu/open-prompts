import { NextResponse } from 'next/server';
import type {
  AccountTemplatesPageResponseDto,
  MyTemplatesQueryDto,
} from '~/lib/account/account-dto';
import type {
  PromptTemplateMutationResponseDto,
  PromptWriteRequestDto,
} from '~/lib/prompts/prompt-dto';
import {
  persistPromptImageInputs,
  preparePromptImageAssets,
  reconcilePromptImageAssetVisibility,
} from '~/lib/assets/asset-service';
import { resolveAssetOwner } from '~/lib/assets/asset-owner';
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
    const assetOwner = await resolveAssetOwner({
      cookieHeader: req.headers.get('cookie') || '',
      userId: session.user.id,
      issueAnonymous: false,
    });
    if (!assetOwner.ownerId) throw new Error('Unable to resolve image asset owner.');
    const images = await persistPromptImageInputs({
      db,
      ownerId: assetOwner.ownerId,
      images: v.images,
    });
    const item = await db.transaction(async (tx) => {
      const transactionDb = tx as unknown as typeof db;
      await preparePromptImageAssets({
        db: transactionDb,
        ownerId: assetOwner.ownerId!,
        authorizedOwnerIds: assetOwner.authorizedOwnerIds,
        visibility: 'private',
        images,
      });
      const inserted = await insertUserTemplate(transactionDb, session.user.id, {
        title: v.title,
        description: v.description,
        prompt: v.prompt,
        modelLabel: v.modelLabel,
        category: v.category,
        tags: v.tags,
        images,
        visibility: v.visibility,
        sourceUrl: v.sourceUrl,
        authorHandle: v.authorHandle,
      });
      await reconcilePromptImageAssetVisibility({ db: transactionDb, images });
      return inserted;
    });
    const response: PromptTemplateMutationResponseDto = { ok: true, item };
    return NextResponse.json(response);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Create failed';
    console.error('[my/templates POST]', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
