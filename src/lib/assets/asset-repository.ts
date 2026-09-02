import { and, asc, eq, inArray, lt, sql } from 'drizzle-orm';
import type { Db } from '~/db/client';
import { generationJobs, imageAssets, prompts } from '~/db/schema';
import type {
  ImageAssetSource,
  ImageAssetStatus,
  ImageAssetVisibility,
} from '~/lib/assets/asset-types';
import { imageAssetUrl } from '~/lib/assets/asset-types';

export type ImageAssetRecord = typeof imageAssets.$inferSelect;

type InsertImageAsset = {
  id: string;
  objectKey: string;
  ownerId: string;
  mimeType: string;
  byteSize: number;
  source: ImageAssetSource;
  visibility: ImageAssetVisibility;
  provider?: string | null;
  providerJobId?: string | null;
  imageIndex?: number | null;
};

function databaseErrorCode(error: unknown): string {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : '';
}

export async function getImageAssetById(
  db: Db,
  assetId: string,
): Promise<ImageAssetRecord | null> {
  const [row] = await db
    .select()
    .from(imageAssets)
    .where(eq(imageAssets.id, assetId))
    .limit(1);
  return row ?? null;
}

export async function getImageAssetsByIds(
  db: Db,
  assetIds: string[],
): Promise<ImageAssetRecord[]> {
  const ids = Array.from(new Set(assetIds));
  if (!ids.length) return [];
  return db.select().from(imageAssets).where(inArray(imageAssets.id, ids));
}

export async function getGeneratedImageAsset(
  db: Db,
  provider: string,
  providerJobId: string,
  imageIndex: number,
): Promise<ImageAssetRecord | null> {
  const [row] = await db
    .select()
    .from(imageAssets)
    .where(
      and(
        eq(imageAssets.provider, provider),
        eq(imageAssets.providerJobId, providerJobId),
        eq(imageAssets.imageIndex, imageIndex),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function insertPendingImageAsset(
  db: Db,
  value: InsertImageAsset,
): Promise<ImageAssetRecord> {
  const [row] = await db
    .insert(imageAssets)
    .values({
      ...value,
      status: 'pending',
      provider: value.provider ?? null,
      providerJobId: value.providerJobId ?? null,
      imageIndex: value.imageIndex ?? null,
    })
    .returning();
  if (!row) throw new Error('Image asset insert returned no row.');
  return row;
}

export async function insertPendingGeneratedImageAsset(
  db: Db,
  value: InsertImageAsset & {
    provider: string;
    providerJobId: string;
    imageIndex: number;
  },
): Promise<{ row: ImageAssetRecord; inserted: boolean }> {
  try {
    return { row: await insertPendingImageAsset(db, value), inserted: true };
  } catch (error: unknown) {
    if (databaseErrorCode(error) !== '23505') throw error;
    const existing = await getGeneratedImageAsset(
      db,
      value.provider,
      value.providerJobId,
      value.imageIndex,
    );
    if (!existing) throw error;
    return { row: existing, inserted: false };
  }
}

export async function updateImageAssetContentMetadata(args: {
  db: Db;
  assetId: string;
  ownerId: string;
  claimId: string;
  mimeType: string;
  byteSize: number;
}): Promise<void> {
  const updated = await args.db
    .update(imageAssets)
    .set({
      mimeType: args.mimeType,
      byteSize: args.byteSize,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(imageAssets.id, args.assetId),
        eq(imageAssets.ownerId, args.ownerId),
        eq(imageAssets.status, 'persisting'),
        eq(imageAssets.persistenceClaimId, args.claimId),
      ),
    )
    .returning({ id: imageAssets.id });
  if (updated.length !== 1) {
    throw new Error('Generated image persistence claim was lost.');
  }
}

export async function claimGeneratedImageAssetPersistence(args: {
  db: Db;
  assetId: string;
  ownerId: string;
  claimId: string;
  staleBefore: Date;
}): Promise<boolean> {
  const claimed = await args.db
    .update(imageAssets)
    .set({
      status: 'persisting',
      persistenceClaimId: args.claimId,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(imageAssets.id, args.assetId),
        eq(imageAssets.ownerId, args.ownerId),
        sql`(
          ${imageAssets.status} in ('pending', 'failed')
          or (
            ${imageAssets.status} = 'persisting'
            and ${imageAssets.updatedAt} < ${args.staleBefore}
          )
        )`,
      ),
    )
    .returning({ id: imageAssets.id });
  return claimed.length === 1;
}

export async function completeGeneratedImageAssetPersistence(args: {
  db: Db;
  assetId: string;
  ownerId: string;
  claimId: string;
}): Promise<void> {
  const updated = await args.db
    .update(imageAssets)
    .set({
      status: 'ready',
      persistenceClaimId: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(imageAssets.id, args.assetId),
        eq(imageAssets.ownerId, args.ownerId),
        eq(imageAssets.status, 'persisting'),
        eq(imageAssets.persistenceClaimId, args.claimId),
      ),
    )
    .returning({ id: imageAssets.id });
  if (updated.length !== 1) {
    throw new Error('Generated image persistence claim was lost.');
  }
}

export async function recoverStoredGeneratedImageAsset(args: {
  db: Db;
  assetId: string;
  ownerId: string;
  staleBefore: Date;
}): Promise<boolean> {
  const updated = await args.db
    .update(imageAssets)
    .set({
      status: 'ready',
      persistenceClaimId: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(imageAssets.id, args.assetId),
        eq(imageAssets.ownerId, args.ownerId),
        sql`(
          ${imageAssets.status} in ('pending', 'failed')
          or (
            ${imageAssets.status} = 'persisting'
            and ${imageAssets.updatedAt} < ${args.staleBefore}
          )
        )`,
      ),
    )
    .returning({ id: imageAssets.id });
  return updated.length === 1;
}

export async function failGeneratedImageAssetPersistence(args: {
  db: Db;
  assetId: string;
  ownerId: string;
  claimId: string;
}): Promise<void> {
  await args.db
    .update(imageAssets)
    .set({
      status: 'failed',
      persistenceClaimId: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(imageAssets.id, args.assetId),
        eq(imageAssets.ownerId, args.ownerId),
        eq(imageAssets.status, 'persisting'),
        eq(imageAssets.persistenceClaimId, args.claimId),
      ),
    );
}

export async function updateImageAssetStatus(
  db: Db,
  assetId: string,
  status: ImageAssetStatus,
): Promise<void> {
  await db
    .update(imageAssets)
    .set({
      status,
      ...(status === 'persisting' ? {} : { persistenceClaimId: null }),
      updatedAt: new Date(),
    })
    .where(eq(imageAssets.id, assetId));
}

export async function deleteImageAssetRecord(db: Db, assetId: string): Promise<void> {
  await db.delete(imageAssets).where(eq(imageAssets.id, assetId));
}

export async function authorizeAndSetReferencedAssetsVisibility(args: {
  db: Db;
  ownerId: string;
  authorizedOwnerIds: string[];
  visibility: ImageAssetVisibility;
  assetIds: string[];
}): Promise<void> {
  const ids = Array.from(new Set(args.assetIds));
  if (!ids.length) return;
  const authorizedOwnerIds = Array.from(new Set(args.authorizedOwnerIds));
  if (!authorizedOwnerIds.length || !authorizedOwnerIds.includes(args.ownerId)) {
    throw new Error('A trusted image asset owner is required.');
  }

  const rows = await getImageAssetsByIds(args.db, ids);
  if (rows.length !== ids.length) throw new Error('One or more image assets do not exist.');
  if (rows.some((row) => !authorizedOwnerIds.includes(row.ownerId))) {
    throw new Error('One or more image assets are not owned by the current user.');
  }
  if (rows.some((row) => row.status !== 'ready')) {
    throw new Error('One or more image assets are not ready.');
  }

  const updated = await args.db
    .update(imageAssets)
    .set({
      ownerId: args.ownerId,
      ...(args.visibility === 'public' ? { visibility: 'public' as const } : {}),
      updatedAt: new Date(),
    })
    .where(
      and(
        inArray(imageAssets.id, ids),
        inArray(imageAssets.ownerId, authorizedOwnerIds),
        eq(imageAssets.status, 'ready'),
      ),
    )
    .returning({ id: imageAssets.id });
  if (updated.length !== ids.length) {
    throw new Error('One or more image assets changed while being attached.');
  }
}

export async function reconcileAssetsVisibility(args: {
  db: Db;
  assetIds: string[];
}): Promise<void> {
  const ids = Array.from(new Set(args.assetIds)).sort();
  for (const id of ids) {
    const reference = imageAssetUrl(id);
    const [publicReference] = await args.db
      .select({ id: prompts.id })
      .from(prompts)
      .where(
        and(
          eq(prompts.visibility, 'public'),
          eq(prompts.status, 'approved'),
          sql`${reference} = any(${prompts.images})`,
        ),
      )
      .limit(1);
    await args.db
      .update(imageAssets)
      .set({
        visibility: publicReference ? 'public' : 'private',
        updatedAt: new Date(),
      })
      .where(eq(imageAssets.id, id));
  }
}

export async function listStaleImageAssets(args: {
  db: Db;
  olderThan: Date;
  limit: number;
}): Promise<ImageAssetRecord[]> {
  return args.db
    .select()
    .from(imageAssets)
    .where(lt(imageAssets.updatedAt, args.olderThan))
    .orderBy(asc(imageAssets.updatedAt))
    .limit(Math.min(Math.max(args.limit, 1), 500));
}

export async function claimOwnedImageAssetForDeletion(args: {
  db: Db;
  row: ImageAssetRecord;
  authorizedOwnerIds: string[];
}): Promise<boolean> {
  const claimed = await args.db
    .update(imageAssets)
    .set({
      status: 'deleting',
      persistenceClaimId: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(imageAssets.id, args.row.id),
        eq(imageAssets.status, args.row.status),
        inArray(imageAssets.ownerId, args.authorizedOwnerIds),
      ),
    )
    .returning({ id: imageAssets.id });
  return claimed.length === 1;
}

export async function claimImageAssetForCleanup(args: {
  db: Db;
  row: ImageAssetRecord;
  olderThan: Date;
}): Promise<boolean> {
  const claimed = await args.db
    .update(imageAssets)
    .set({
      status: 'deleting',
      persistenceClaimId: null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(imageAssets.id, args.row.id),
        eq(imageAssets.status, args.row.status),
        lt(imageAssets.updatedAt, args.olderThan),
      ),
    )
    .returning({ id: imageAssets.id });
  return claimed.length === 1;
}

export async function isImageAssetReferenced(db: Db, assetId: string): Promise<boolean> {
  const reference = `/api/assets/${assetId}`;
  const [promptReference] = await db
    .select({ id: prompts.id })
    .from(prompts)
    .where(sql`${reference} = any(${prompts.images})`)
    .limit(1);
  if (promptReference) return true;

  const [generationReference] = await db
    .select({ id: generationJobs.id })
    .from(generationJobs)
    .where(sql`${assetId}::uuid = any(${generationJobs.resultAssetIds})`)
    .limit(1);
  if (generationReference) return true;

  const asset = await getImageAssetById(db, assetId);
  if (
    asset?.source !== 'generated' ||
    !asset.provider ||
    !asset.providerJobId
  ) {
    return false;
  }
  const [generationJob] = await db
    .select({ id: generationJobs.id })
    .from(generationJobs)
    .where(
      and(
        eq(generationJobs.provider, asset.provider),
        eq(generationJobs.providerJobId, asset.providerJobId),
        inArray(generationJobs.status, ['queued', 'running', 'succeeded']),
      ),
    )
    .limit(1);
  return Boolean(generationJob);
}