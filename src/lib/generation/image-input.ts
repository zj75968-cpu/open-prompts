import type { GenerationCreateParams, GenerationImageInput } from '~/lib/generation/types';

export const MAX_GENERATION_REFERENCE_IMAGES = 4;
export const MAX_GENERATION_REFERENCE_IMAGE_BYTES = 10 * 1024 * 1024;
export const IMAGE_INPUT_TIMEOUT_MS = 30_000;

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

function isPrivateOrLocalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/[\[\]]/g, '');
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host === 'metadata.google.internal' ||
    host === 'metadata' ||
    host === '::1'
  ) {
    return true;
  }

  const octets = host.split('.').map(Number);
  if (octets.length !== 4 || octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return false;
  }
  const [first, second] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168)
  );
}

function parseRemoteImageUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Reference image URL is invalid.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Reference image URL must use HTTP or HTTPS.');
  }
  if (isPrivateOrLocalHostname(url.hostname)) {
    throw new Error('Reference image URL must point to a public image host.');
  }
  return url;
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

function timeoutSignal(timeoutMs: number): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  return { signal: controller.signal, clear: () => clearTimeout(timeout) };
}

async function readResponseWithinLimit(response: Response): Promise<ArrayBuffer> {
  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength > MAX_GENERATION_REFERENCE_IMAGE_BYTES) {
    throw new Error(
      `Reference image exceeds the ${Math.round(MAX_GENERATION_REFERENCE_IMAGE_BYTES / 1024 / 1024)} MB size limit.`,
    );
  }

  if (!response.body) {
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_GENERATION_REFERENCE_IMAGE_BYTES) {
      throw new Error(
        `Reference image exceeds the ${Math.round(MAX_GENERATION_REFERENCE_IMAGE_BYTES / 1024 / 1024)} MB size limit.`,
      );
    }
    return buffer;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_GENERATION_REFERENCE_IMAGE_BYTES) {
        await reader.cancel();
        throw new Error(
          `Reference image exceeds the ${Math.round(MAX_GENERATION_REFERENCE_IMAGE_BYTES / 1024 / 1024)} MB size limit.`,
        );
      }
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
  return bytes.buffer;
}

async function fetchRemoteImage(value: string): Promise<Blob> {
  let currentUrl = parseRemoteImageUrl(value);
  for (let redirect = 0; redirect < 4; redirect += 1) {
    const { signal, clear } = timeoutSignal(IMAGE_INPUT_TIMEOUT_MS);
    let response: Response;
    try {
      response = await fetch(currentUrl, { redirect: 'manual', signal });
    } catch (error: unknown) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('Timed out while reading reference image.');
      }
      throw new Error(
        `Unable to read reference image: ${error instanceof Error ? error.message : 'fetch failed'}`,
      );
    } finally {
      clear();
    }

    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get('location');
      if (!location || redirect === 3) throw new Error('Reference image redirected too many times.');
      currentUrl = parseRemoteImageUrl(new URL(location, currentUrl).toString());
      continue;
    }
    if (!response.ok) throw new Error(`Unable to read reference image: ${response.status}`);

    const contentType = normalizedMimeType(response.headers.get('content-type') || '');
    const mimeType = contentType
      ? assertSupportedImageMimeType(contentType, currentUrl.hostname)
      : assertSupportedImageMimeType(
          IMAGE_EXTENSION_MIME_TYPES[currentUrl.pathname.split('.').pop()?.toLowerCase() || ''],
          currentUrl.hostname,
        );
    const buffer = await readResponseWithinLimit(response);
    return new Blob([buffer], { type: mimeType });
  }
  throw new Error('Unable to read reference image.');
}

export async function imageInputToBlob(value: string): Promise<Blob> {
  const normalized = value.trim();
  const data = splitDataUrl(normalized);
  if (data) {
    const mimeType = assertSupportedImageMimeType(data.mimeType, 'data URL');
    assertBase64Size(data.base64);
    const binary = globalThis.atob(data.base64);
    const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
    return new Blob([bytes], { type: mimeType });
  }
  return fetchRemoteImage(normalized);
}
