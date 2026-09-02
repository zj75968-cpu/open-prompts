export const imageAssetSources = ['upload', 'generated', 'imported'] as const;
export type ImageAssetSource = (typeof imageAssetSources)[number];

export const imageAssetVisibilities = ['private', 'public'] as const;
export type ImageAssetVisibility = (typeof imageAssetVisibilities)[number];

export const imageAssetStatuses = ['pending', 'persisting', 'ready', 'deleting', 'failed'] as const;
export type ImageAssetStatus = (typeof imageAssetStatuses)[number];

export type ImageAssetDto = {
  id: string;
  url: string;
  mimeType: string;
  byteSize: number;
  width: number | null;
  height: number | null;
  source: ImageAssetSource;
  visibility: ImageAssetVisibility;
  status: ImageAssetStatus;
};

const UUID_PATTERN = '[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}';
const IMAGE_ASSET_PATH = new RegExp(`^/api/assets/(${UUID_PATTERN})(?:[?#].*)?$`, 'i');

export function isImageAssetId(value: string): boolean {
  return new RegExp(`^${UUID_PATTERN}$`, 'i').test(String(value || '').trim());
}

export function imageAssetUrl(assetId: string): string {
  return `/api/assets/${assetId}`;
}

export function normalizeImageAssetReference(value: string): string {
  const id = imageAssetIdFromReference(value);
  return id ? imageAssetUrl(id) : String(value || '').trim();
}

export function isRemoteImageReference(value: string): boolean {
  return /^https?:\/\//i.test(String(value || '').trim()) && !imageAssetIdFromReference(value);
}

export function newRemoteImageReferences(
  nextValues: readonly string[],
  previousValues: readonly string[] = [],
): string[] {
  const previous = new Set(
    previousValues
      .filter(isRemoteImageReference)
      .map((value) => String(value || '').trim()),
  );
  return Array.from(
    new Set(
      nextValues
        .filter(isRemoteImageReference)
        .map((value) => String(value || '').trim())
        .filter((value) => !previous.has(value)),
    ),
  );
}

export function imageAssetIdsFromReferences(values: readonly string[]): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => imageAssetIdFromReference(value))
        .filter((value): value is string => Boolean(value)),
    ),
  );
}

export function imageAssetIdFromReference(value: string): string | null {
  const normalized = String(value || '').trim();
  let path = normalized;
  if (/^https?:\/\//i.test(normalized)) {
    try {
      const url = new URL(normalized);
      path = `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return null;
    }
  }
  const match = IMAGE_ASSET_PATH.exec(path);
  return match?.[1]?.toLowerCase() ?? null;
}