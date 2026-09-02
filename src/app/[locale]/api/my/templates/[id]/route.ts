import { NextResponse } from 'next/server';
import type {
  PromptDeleteResponseDto,
  PromptTemplateMutationResponseDto,
  PromptTemplateResponseDto,
  PromptWriteRequestDto,
} from '~/lib/prompts/prompt-dto';
import {
  persistPromptImageInputs,
  preparePromptImageAssets,
  reconcilePromptImageAssetVisibility,
} from '~/lib/assets/asset-service';
import {
  assetOwnerIdForUser,
  resolveAssetOwner,
} from '~/lib/assets/asset-owner';
import { getDb } from '~/db/client';
import { isAdminEmail } from '~/lib/auth/admin-emails';
import { requireAuthSession } from '~/lib/auth/session';
import { parseTemplateBody } from '~/lib/prompts/parse-template-body';
import {
  deleteUserTemplate,
  getTemplateById,
  getTemplateByIdForUpdate,
  updateUserTemplate,
} from '~/lib/prompts/template-record';
import { checkXSourceDuplicate } from '~/lib/x-import/x-source-duplicate';

export const dynamic = 'force-dynamic';

function parseId(raw: string): number | null {
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : null;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const { id: raw } = await params;
  const id = parseId(raw);
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const item = await getTemplateById(db, id);
  if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  const isAdmin = isAdminEmail(session.user.email);
  if (!isAdmin && item.submittedBy !== session.user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const response: PromptTemplateResponseDto = { item };
  return NextResponse.json(response);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const { id: raw } = await params;
  const id = parseId(raw);
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

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
  const isAdmin = isAdminEmail(session.user.email);
  try {
    const existing = await getTemplateById(db, id);
    if (!existing || (!isAdmin && existing.submittedBy !== session.user.id)) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    const duplicate = await checkXSourceDuplicate(db, v.sourceUrl, id);
    if (duplicate) {
      return NextResponse.json({ error: 'duplicate_x_source', duplicate }, { status: 409 });
    }
    const requesterOwner = await resolveAssetOwner({
      cookieHeader: req.headers.get('cookie') || '',
      userId: session.user.id,
      issueAnonymous: false,
    });
    if (!requesterOwner.ownerId) throw new Error('Unable to resolve image asset owner.');
    const targetOwnerId =
      isAdmin && existing.submittedBy
        ? assetOwnerIdForUser(existing.submittedBy)
        : requesterOwner.ownerId;
    const targetLegacyOwnerId = targetOwnerId.startsWith('user:')
      ? targetOwnerId.slice('user:'.length)
      : null;
    const authorizedOwnerIds = Array.from(
      new Set([
        ...requesterOwner.authorizedOwnerIds,
        targetOwnerId,
        ...(targetLegacyOwnerId ? [targetLegacyOwnerId] : []),
      ]),
    );
    const images = await persistPromptImageInputs({
      db,
      ownerId: targetOwnerId,
      images: v.images,
      legacyRemoteReferences: existing.images,
    });
    const item = await db.transaction(async (tx) => {
      const transactionDb = tx as unknown as typeof db;
      const lockedExisting = await getTemplateByIdForUpdate(transactionDb, id);
      if (
        !lockedExisting ||
        (!isAdmin && lockedExisting.submittedBy !== session.user.id)
      ) {
        return null;
      }
      const assetVisibility =
        isAdmin &&
        v.visibility === 'public' &&
        lockedExisting.status === 'approved'
          ? 'public'
          : 'private';
      await preparePromptImageAssets({
        db: transactionDb,
        ownerId: targetOwnerId,
        authorizedOwnerIds,
        visibility: assetVisibility,
        images,
      });
      const updated = await updateUserTemplate(
        transactionDb,
        id,
        session.user.id,
        {
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
        },
        isAdmin,
      );
      if (updated) {
        await reconcilePromptImageAssetVisibility({
          db: transactionDb,
          images: [...lockedExisting.images, ...images],
        });
      }
      return updated;
    });
    if (!item) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    const response: PromptTemplateMutationResponseDto = { ok: true, item };
    return NextResponse.json(response);
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : 'Update failed';
    console.error('[my/templates PATCH]', e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await requireAuthSession();
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getDb();
  if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  const { id: raw } = await params;
  const id = parseId(raw);
  if (!id) return NextResponse.json({ error: 'Invalid id' }, { status: 400 });

  const isAdmin = isAdminEmail(session.user.email);
  const existing = await getTemplateById(db, id);
  if (!existing || (!isAdmin && existing.submittedBy !== session.user.id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  const result = await db.transaction(async (tx) => {
    const transactionDb = tx as unknown as typeof db;
    const lockedExisting = await getTemplateByIdForUpdate(transactionDb, id);
    if (
      !lockedExisting ||
      (!isAdmin && lockedExisting.submittedBy !== session.user.id)
    ) {
      return { deleted: false };
    }
    const deleted = await deleteUserTemplate(
      transactionDb,
      id,
      session.user.id,
      isAdmin,
    );
    if (deleted) {
      await reconcilePromptImageAssetVisibility({
        db: transactionDb,
        images: lockedExisting.images,
      });
    }
    return { deleted };
  });
  if (!result.deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const response: PromptDeleteResponseDto = { ok: true };
  return NextResponse.json(response);
}
