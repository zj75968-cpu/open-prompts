import type { Db } from '~/db/client';
import { assetOwnerStoragePath } from '~/lib/assets/asset-owner';
import type { ImageAssetRecord } from '~/lib/assets/asset-repository';
import {
  authorizeAndSetReferencedAssetsVisibility,
  claimGeneratedImageAssetPersistence,
  claimImageAssetForCleanup,
  claimOwnedImageAssetForDeletion,
  completeGeneratedImageAssetPersistence,
  deleteImageAssetRecord,
  failGeneratedImageAssetPersistence,
  getGeneratedImageAsset,
  getImageAssetById,
  getImageAssetsByIds,
  insertPendingGeneratedImageAsset,
  insertPendingImageAsset,
  isImageAssetReferenced,
  listStaleImageAssets,
  reconcileAssetsVisibility,
  recoverStoredGeneratedImageAsset,
  updateImageAssetContentMetadata,
  updateImageAssetStatus,
} from '~/lib/assets/asset-repository';
import { getImageAssetsBucket } from '~/lib/assets/cloudflare-r2';
import {
  imageInputFromFile,
  imageInputFromProviderOutput,
  imageInputFromRemoteUrl,
  type ValidatedImageInput,
} from '~/lib/assets/image-input';
import {
  imageAssetIdFromReference,
  imageAssetIdsFromReferences,
  imageAssetUrl,
  isRemoteImageReference,
  normalizeImageAssetReference,
  type ImageAssetDto,
  type ImageAssetSource,
  type ImageAssetVisibility,
} from '~/lib/assets/asset-types';

export type PersistedGenerationImages = {
  assetIds: string[];
  urls: string[];
};

const GENERATED_IMAGE_CLAIM_LEASE_MS = 5 * 60 * 1000;

function assetId(): string {
  const id = globalThis.crypto?.randomUUID?.();
  if (!id) throw new Error('Secure random UUID generation is unavailable.');
  return id;
}

function uploadObjectKey(ownerId: string, id: string, extension: string): string {
  return `${assetOwnerStoragePath(ownerId)}/uploads/${id}/original.${extension}`;
}

function importedObjectKey(ownerId: string, id: string, extension: string): string {
  return `${assetOwnerStoragePath(ownerId)}/imports/${id}/original.${extension}`;
}

function generatedObjectKey(
  ownerId: string,
  id: string,
  imageIndex: number,
  extension: string,
): string {
  return `${assetOwnerStoragePath(ownerId)}/generated/${id}/${imageIndex}.${extension}`;
}

function toDto(
  row: ImageAssetRecord,
  status: ImageAssetDto['status'] = row.status as ImageAssetDto['status'],
): ImageAssetDto {
  return {
    id: row.id,
    url: imageAssetUrl(row.id),
    mimeType: row.mimeType,
    byteSize: row.byteSize,
    width: row.width,
    height: row.height,
    source: row.source as ImageAssetDto['source'],
    visibility: row.visibility as ImageAssetDto['visibility'],
    status,
  };
}

async function putAssetObject(args: {
  objectKey: string;
  assetId: string;
  input: ValidatedImageInput;
  source: ImageAssetSource;
}): Promise<void> {
  const bucket = await getImageAssetsBucket();
  await bucket.put(args.objectKey, args.input.bytes, {
    httpMetadata: {
      contentType: args.input.mimeType,
      cacheControl: 'private, no-store',
    },
    customMetadata: {
      assetId: args.assetId,
      source: args.source,
    },
  });
}

async function rollbackNewAsset(db: Db, row: ImageAssetRecord): Promise<void> {
  let objectDeleted = false;
  try {
    const bucket = await getImageAssetsBucket();
    await bucket.delete(row.objectKey);
    objectDeleted = true;
  } catch {
    // Keep failed metadata so cleanup can retry the R2 deletion.
  }
  if (!objectDeleted) {
    await updateImageAssetStatus(db, row.id, 'failed').catch(() => undefined);
    return;
  }
  try {
    await deleteImageAssetRecord(db, row.id);
  } catch {
    await updateImageAssetStatus(db, row.id, 'failed').catch(() => undefined);
  }
}

async function createOwnedImageAsset(args: {
  db: Db;
  ownerId: string;
  input: ValidatedImageInput;
  source: Extract<ImageAssetSource, 'upload' | 'imported'>;
}): Promise<ImageAssetDto> {
  await getImageAssetsBucket();
  const id = assetId();
  const objectKey =
    args.source === 'upload'
      ? uploadObjectKey(args.ownerId, id, args.input.extension)
      : importedObjectKey(args.ownerId, id, args.input.extension);
  const row = await insertPendingImageAsset(args.db, {
    id,
    objectKey,
    ownerId: args.ownerId,
    mimeType: args.input.mimeType,
    byteSize: args.input.bytes.byteLength,
    source: args.source,
    visibility: 'private',
  });

  try {
    await putAssetObject({
      objectKey,
      assetId: id,
      input: args.input,
      source: args.source,
    });
    await updateImageAssetStatus(args.db, id, 'ready');
    return toDto(row, 'ready');
  } catch (error: unknown) {
    await rollbackNewAsset(args.db, row);
    throw error;
  }
}

export async function createUploadedImageAsset(args: {
  db: Db;
  ownerId: string;
  file: File;
}): Promise<ImageAssetDto> {
  return createOwnedImageAsset({
    db: args.db,
    ownerId: args.ownerId,
    input: await imageInputFromFile(args.file),
    source: 'upload',
  });
}

export async function createImportedImageAsset(args: {
  db: Db;
  ownerId: string;
  remoteUrl: string;
}): Promise<ImageAssetDto> {
  return createOwnedImageAsset({
    db: args.db,
    ownerId: args.ownerId,
    input: await imageInputFromRemoteUrl(args.remoteUrl),
    source: 'imported',
  });
}

export async function persistGeneratedImageOutputs(args: {
  db: Db;
  ownerId: string;
  provider: string;
  providerJobId: string;
  images: string[];
}): Promise<PersistedGenerationImages> {
  const bucket = await getImageAssetsBucket();
  const assetIds: string[] = [];
  const urls: string[] = [];
  const appendResult = (row: ImageAssetRecord) => {
    assetIds.push(row.id);
    urls.push(imageAssetUrl(row.id));
  };

  for (let imageIndex = 0; imageIndex < args.images.length; imageIndex += 1) {
    const staleBefore = new Date(Date.now() - GENERATED_IMAGE_CLAIM_LEASE_MS);
    const existing = await getGeneratedImageAsset(
      args.db,
      args.provider,
      args.providerJobId,
      imageIndex,
    );
    if (existing && existing.ownerId !== args.ownerId) {
      throw new Error('Generated image ownership conflict.');
    }
    if (existing?.status === 'ready') {
      appendResult(existing);
      continue;
    }
    if (existing) {
      const stored = await bucket.get(existing.objectKey);
      if (
        stored &&
        stored.size === existing.byteSize &&
        stored.customMetadata?.assetId === existing.id
      ) {
        await recoverStoredGeneratedImageAsset({
          db: args.db,
          assetId: existing.id,
          ownerId: args.ownerId,
          staleBefore,
        });
        const recovered = await getGeneratedImageAsset(
          args.db,
          args.provider,
          args.providerJobId,
          imageIndex,
        );
        if (recovered?.status === 'ready' && recovered.ownerId === args.ownerId) {
          appendResult(recovered);
          continue;
        }
      }
    }

    const input = await imageInputFromProviderOutput(args.images[imageIndex]);
    const id = existing?.id ?? assetId();
    const objectKey =
      existing?.objectKey ??
      generatedObjectKey(args.ownerId, id, imageIndex, input.extension);
    const reservation = existing
      ? { row: existing }
      : await insertPendingGeneratedImageAsset(args.db, {
          id,
          objectKey,
          ownerId: args.ownerId,
          mimeType: input.mimeType,
          byteSize: input.bytes.byteLength,
          source: 'generated',
          visibility: 'private',
          provider: args.provider,
          providerJobId: args.providerJobId,
          imageIndex,
        });
    const row = reservation.row;
    if (row.ownerId !== args.ownerId) {
      throw new Error('Generated image ownership conflict.');
    }
    if (row.status === 'ready') {
      appendResult(row);
      continue;
    }

    const claimId = assetId();
    const claimed = await claimGeneratedImageAssetPersistence({
      db: args.db,
      assetId: row.id,
      ownerId: args.ownerId,
      claimId,
      staleBefore,
    });
    if (!claimed) {
      const current = await getGeneratedImageAsset(
        args.db,
        args.provider,
        args.providerJobId,
        imageIndex,
      );
      if (!current || current.ownerId !== args.ownerId) {
        throw new Error('Generated image ownership conflict.');
      }
      if (current.status === 'ready') {
        appendResult(current);
        continue;
      }
      throw new Error('Generated image persistence is already in progress.');
    }

    try {
      await updateImageAssetContentMetadata({
        db: args.db,
        assetId: row.id,
        ownerId: args.ownerId,
        claimId,
        mimeType: input.mimeType,
        byteSize: input.bytes.byteLength,
      });
      await putAssetObject({
        objectKey: row.objectKey,
        assetId: row.id,
        input,
        source: 'generated',
      });
      await completeGeneratedImageAssetPersistence({
        db: args.db,
        assetId: row.id,
        ownerId: args.ownerId,
        claimId,
      });
      appendResult(row);
    } catch (error: unknown) {
      await failGeneratedImageAssetPersistence({
        db: args.db,
        assetId: row.id,
        ownerId: args.ownerId,
        claimId,
      }).catch(() => undefined);
      throw error;
    }
  }
  return { assetIds, urls };
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    for (let index = 0; index < chunk.length; index += 1) {
      binary += String.fromCharCode(chunk[index]);
    }
  }
  return globalThis.btoa(binary);
}

function imageDataUrl(input: ValidatedImageInput): string {
  return `data:${input.mimeType};base64,${bytesToBase64(input.bytes)}`;
}

async function readStream(stream: ReadableStream<Uint8Array>): Promise<Uint8Array> {
  const reader = stream.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

export async function resolveGenerationImageAssetInputs(args: {
  db: Db;
  requesterOwnerIds: string[];
  images: string[];
}): Promise<string[]> {
  return Promise.all(
    args.images.map(async (image) => {
      const id = imageAssetIdFromReference(image);
      if (!id) return imageDataUrl(await imageInputFromProviderOutput(image));
      const asset = await getReadableImageAsset({
        db: args.db,
        assetId: id,
        requesterOwnerIds: args.requesterOwnerIds,
      });
      if (!asset) throw new Error('Reference image asset was not found or is not accessible.');
      const bytes = await readStream(asset.body);
      return `data:${asset.row.mimeType};base64,${bytesToBase64(bytes)}`;
    }),
  );
}

export async function persistPromptImageInputs(args: {
  db: Db;
  ownerId: string;
  images: string[];
  legacyRemoteReferences?: string[];
}): Promise<string[]> {
  const legacyRemoteReferences = new Set(
    (args.legacyRemoteReferences ?? [])
      .filter(isRemoteImageReference)
      .map((value) => String(value || '').trim()),
  );
  const imported = new Map<string, string>();
  const persistedImages: string[] = [];

  for (const rawImage of args.images) {
    const image = normalizeImageAssetReference(rawImage);
    if (!isRemoteImageReference(image) || legacyRemoteReferences.has(image)) {
      persistedImages.push(image);
      continue;
    }
    const cached = imported.get(image);
    if (cached) {
      persistedImages.push(cached);
      continue;
    }
    const asset = await createImportedImageAsset({
      db: args.db,
      ownerId: args.ownerId,
      remoteUrl: image,
    });
    imported.set(image, asset.url);
    persistedImages.push(asset.url);
  }

  return persistedImages;
}

export async function preparePromptImageAssets(args: {
  db: Db;
  ownerId: string;
  authorizedOwnerIds: string[];
  visibility: ImageAssetVisibility;
  images: string[];
}): Promise<void> {
  await authorizeAndSetReferencedAssetsVisibility({
    db: args.db,
    ownerId: args.ownerId,
    authorizedOwnerIds: args.authorizedOwnerIds,
    visibility: args.visibility,
    assetIds: imageAssetIdsFromReferences(args.images),
  });
}

export async function reconcilePromptImageAssetVisibility(args: {
  db: Db;
  images: string[];
}): Promise<void> {
  await reconcileAssetsVisibility({
    db: args.db,
    assetIds: imageAssetIdsFromReferences(args.images),
  });
}

export async function getReadableImageAsset(args: {
  db: Db;
  assetId: string;
  requesterOwnerIds: string[];
  allowPrivate?: boolean;
}): Promise<{ row: ImageAssetRecord; body: ReadableStream<Uint8Array>; etag: string } | null> {
  const row = await getImageAssetById(args.db, args.assetId);
  if (!row || row.status !== 'ready') return null;
  const canRead =
    row.visibility === 'public' ||
    args.allowPrivate === true ||
    args.requesterOwnerIds.includes(row.ownerId);
  if (!canRead) return null;

  const bucket = await getImageAssetsBucket();
  const object = await bucket.get(row.objectKey);
  if (
    !object ||
    object.size !== row.byteSize ||
    object.customMetadata?.assetId !== row.id
  ) {
    await updateImageAssetStatus(args.db, row.id, 'failed').catch(() => undefined);
    return null;
  }
  return { row, body: object.body, etag: object.httpEtag };
}

export async function getPersistedGenerationImageUrls(args: {
  db: Db;
  ownerId: string;
  assetIds: string[];
}): Promise<string[] | null> {
  if (!args.assetIds.length) return null;
  const rows = await getImageAssetsByIds(args.db, args.assetIds);
  if (
    rows.length !== args.assetIds.length ||
    rows.some((row) => row.ownerId !== args.ownerId || row.status !== 'ready')
  ) {
    return null;
  }
  const byId = new Map(rows.map((row) => [row.id, row]));
  return args.assetIds.every((id) => byId.has(id))
    ? args.assetIds.map((id) => imageAssetUrl(id))
    : null;
}

export async function deleteOwnedImageAsset(args: {
  db: Db;
  assetId: string;
  authorizedOwnerIds: string[];
}): Promise<boolean> {
  const row = await getImageAssetById(args.db, args.assetId);
  if (!row || !args.authorizedOwnerIds.includes(row.ownerId)) return false;
  if (await isImageAssetReferenced(args.db, row.id)) {
    throw new Error('Referenced image assets cannot be deleted.');
  }

  const claimed = await claimOwnedImageAssetForDeletion({
    db: args.db,
    row,
    authorizedOwnerIds: args.authorizedOwnerIds,
  });
  if (!claimed) throw new Error('Image asset changed while being deleted.');
  let referencedAfterClaim: boolean;
  try {
    referencedAfterClaim = await isImageAssetReferenced(args.db, row.id);
  } catch (error: unknown) {
    await updateImageAssetStatus(
      args.db,
      row.id,
      row.status === 'persisting' ? 'failed' : row.status,
    ).catch(() => undefined);
    throw error;
  }
  if (referencedAfterClaim) {
    await updateImageAssetStatus(
      args.db,
      row.id,
      row.status === 'persisting' ? 'failed' : row.status,
    );
    throw new Error('Referenced image assets cannot be deleted.');
  }
  try {
    const bucket = await getImageAssetsBucket();
    await bucket.delete(row.objectKey);
    await deleteImageAssetRecord(args.db, row.id);
    return true;
  } catch (error: unknown) {
    await updateImageAssetStatus(args.db, row.id, 'failed').catch(() => undefined);
    throw error;
  }
}

export async function cleanupStaleImageAssets(args: {
  db: Db;
  olderThan: Date;
  limit?: number;
}): Promise<{ scanned: number; deleted: number; retained: number; failed: number }> {
  const rows = await listStaleImageAssets({
    db: args.db,
    olderThan: args.olderThan,
    limit: args.limit ?? 100,
  });
  const bucket = await getImageAssetsBucket();
  let deleted = 0;
  let retained = 0;
  let failed = 0;

  for (const row of rows) {
    try {
      if (await isImageAssetReferenced(args.db, row.id)) {
        await updateImageAssetStatus(args.db, row.id, row.status);
        retained += 1;
        continue;
      }
    } catch {
      failed += 1;
      continue;
    }

    let claimed = false;
    try {
      claimed = await claimImageAssetForCleanup({
        db: args.db,
        row,
        olderThan: args.olderThan,
      });
    } catch {
      failed += 1;
      continue;
    }
    if (!claimed) {
      retained += 1;
      continue;
    }

    let objectDeleted = false;
    try {
      if (await isImageAssetReferenced(args.db, row.id)) {
        await updateImageAssetStatus(
          args.db,
          row.id,
          row.status === 'persisting' ? 'failed' : row.status,
        );
        retained += 1;
        continue;
      }
      await bucket.delete(row.objectKey);
      objectDeleted = true;
      await deleteImageAssetRecord(args.db, row.id);
      deleted += 1;
    } catch {
      failed += 1;
      await updateImageAssetStatus(
        args.db,
        row.id,
        objectDeleted
          ? 'failed'
          : row.status === 'persisting'
            ? 'failed'
            : row.status,
      ).catch(() => undefined);
    }
  }

  return { scanned: rows.length, deleted, retained, failed };
}