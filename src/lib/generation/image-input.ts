import { imageInputFromProviderOutput } from '~/lib/assets/image-input';
import type { GenerationCreateParams, GenerationImageInput } from '~/lib/generation/types';

export const MAX_GENERATION_REFERENCE_IMAGES = 4;
export const MAX_GENERATION_REFERENCE_IMAGE_BYTES = 10 * 1024 * 1024;

const DATA_URL_PATTERN = /^data:([^;,]+)?(?:;charset=[^;,]+)?;base64,([\s\S]+)$/i;
const SUPPORTED_IMAGE_MIME_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp']);
const IMAGE_EXTENSION_MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
};

function normalizedMimeType(value: string | undefined): string {
  return String(value || '').split(';', 1)[0].trim().toLowerCase();
}

function isSupportedImageMimeType(value: string): boolean {
  return SUPPORTED_IMAGE_MIME_TYPES.has(normalizedMimeType(value));
}

function assertSupportedImageMimeType(value: string, source: string): string {
  const mimeType = normalizedMimeType(value);
  if (!isSupportedImageMimeType(mimeType)) {
    throw new Error(
      `Unsupported reference image type${source ? ` from ${source}` : ''}: ${mimeType || 'unknown'}; use PNG, JPEG, or WebP.`,
    );
  }
  return mimeType;
}

function assertBase64Size(base64: string): void {
  const normalized = base64.replace(/\s+/g, '');
  if (!normalized || !/^[a-z0-9+/]*={0,2}$/i.test(normalized)) {
    throw new Error('Invalid base64 reference image data.');
  }
  const padding = normalized.endsWith('==') ? 2 : normalized.endsWith('=') ? 1 : 0;
  const bytes = Math.floor((normalized.length * 3) / 4) - padding;
  if (bytes > MAX_GENERATION_REFERENCE_IMAGE_BYTES) {
    throw new Error(
      `Reference image exceeds the ${Math.round(MAX_GENERATION_REFERENCE_IMAGE_BYTES / 1024 / 1024)} MB size limit.`,
    );
  }
}

export function imageInputToString(input: GenerationImageInput): string | null {
  if (typeof input === 'string') {
    const value = input.trim();
    return value || null;
  }

  if (!input || typeof input !== 'object') return null;

  const value = input.url || input.dataUrl;
  if (typeof value === 'string' && value.trim()) return value.trim();

  if (typeof input.base64 === 'string' && input.base64.trim()) {
    const base64 = input.base64.trim();
    if (base64.startsWith('data:')) return base64;
    const mimeType = input.mimeType?.trim() || 'image/png';
    return `data:${mimeType};base64,${base64}`;
  }

  return null;
}

export function normalizeImageInputs(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  const unique = new Set<string>();
  for (const item of value) {
    const normalized = imageInputToString(item as GenerationImageInput);
    if (!normalized || normalized.startsWith('blob:')) continue;
    unique.add(normalized);
  }
  return Array.from(unique);
}

export function getGenerationImageInputs(
  params: Pick<GenerationCreateParams, 'referenceImages' | 'imageInputs'>,
): string[] {
  return normalizeImageInputs([
    ...(Array.isArray(params.referenceImages) ? params.referenceImages : []),
    ...(Array.isArray(params.imageInputs) ? params.imageInputs : []),
  ]);
}

export function splitDataUrl(value: string): { mimeType: string; base64: string } | null {
  const match = DATA_URL_PATTERN.exec(value.trim());
  if (!match) return null;
  const base64 = match[2].replace(/\s+/g, '');
  assertBase64Size(base64);
  return {
    mimeType: match[1] || 'image/png',
    base64,
  };
}

export function imageFilename(value: string, index: number): string {
  const mimeType = splitDataUrl(value)?.mimeType || 'image/png';
  const extension =
    Object.entries(IMAGE_EXTENSION_MIME_TYPES).find(([, type]) => type === normalizedMimeType(mimeType))?.[0] ||
    'png';
  return `reference-${index + 1}.${extension}`;
}

export async function imageInputToBlob(value: string): Promise<Blob> {
  const input = await imageInputFromProviderOutput(value);
  const mimeType = assertSupportedImageMimeType(input.mimeType, 'validated image input');
  const bytes = new Uint8Array(input.bytes.byteLength);
  bytes.set(input.bytes);
  return new Blob([bytes.buffer], { type: mimeType });
}
