import { NextResponse } from 'next/server';
import type {
  PromptCreateResponseDto,
  PromptGalleryResponseDto,
  PromptWriteRequestDto,
} from '~/lib/prompts/prompt-dto';
import {
  persistPromptImageInputs,
  preparePromptImageAssets,
  reconcilePromptImageAssetVisibility,
} from '~/lib/assets/asset-service';
import {
  AssetOwnerConfigurationError,
  resolveAssetOwner,
} from '~/lib/assets/asset-owner';
import { getDb } from '~/db/client';
import { getAuthSession } from '~/lib/auth/session';
import { getPromptGallery } from '~/lib/prompts/get-prompt-gallery';
import { insertSubmittedPrompt, parseSubmitPromptBody } from '~/lib/prompts/submit-prompt';
import { checkXSourceDuplicate } from '~/lib/x-import/x-source-duplicate';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const prompts = await getPromptGallery();
    const response: PromptGalleryResponseDto = { prompts, source: 'ok' };
    return NextResponse.json(response);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const db = getDb();
  if (!db) {
    return NextResponse.json({ error: 'Database not configured' }, { status: 503 });
  }

  let body: PromptWriteRequestDto;
  try {
    body = (await req.json()) as PromptWriteRequestDto;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = parseSubmitPromptBody(body);
  if (!parsed.ok) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  try {
    const session = await getAuthSession();
    if (parsed.value.visibility === 'private' && !session?.user?.id) {
      return NextResponse.json({ error: 'Sign in required for private templates' }, { status: 401 });
    }
    const assetOwner = await resolveAssetOwner({
      cookieHeader: req.headers.get('cookie') || '',
      userId: session?.user?.id ?? null,
      issueAnonymous: true,
    });
    if (!assetOwner.ownerId) throw new Error('Unable to resolve image asset owner.');
    const duplicate = await checkXSourceDuplicate(db, parsed.value.sourceUrl);
    if (duplicate) {
      return NextResponse.json({ error: 'duplicate_x_source', duplicate }, { status: 409 });
    }
    const images = await persistPromptImageInputs({
      db,
      ownerId: assetOwner.ownerId,
      images: parsed.value.images,
    });
    const row = await db.transaction(async (tx) => {
      const transactionDb = tx as unknown as typeof db;
      await preparePromptImageAssets({
        db: transactionDb,
        ownerId: assetOwner.ownerId!,
        authorizedOwnerIds: assetOwner.authorizedOwnerIds,
        visibility: 'private',
        images,
      });
      const inserted = await insertSubmittedPrompt(
        transactionDb,
        { ...parsed.value, images },
        session?.user?.id ?? null,
      );
      await reconcilePromptImageAssetVisibility({ db: transactionDb, images });
      return inserted;
    });
    const response: PromptCreateResponseDto = {
      ok: true,
      id: row.id,
      slug: row.slug,
    };
    const nextResponse = NextResponse.json(response);
    if (assetOwner.setCookie) nextResponse.headers.append('set-cookie', assetOwner.setCookie);
    return nextResponse;
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Insert failed';
    console.error('[prompts POST]', e);
    return NextResponse.json(
      { error: message },
      { status: e instanceof AssetOwnerConfigurationError ? 503 : 500 },
    );
  }
}
