const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const REMOTE_IMAGE_TIMEOUT_MS = 30_000;

const MIME_EXTENSIONS: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'image/avif': 'avif',
};

const EXTENSION_MIME_TYPES: Record<string, string> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  webp: 'image/webp',
  gif: 'image/gif',
  avif: 'image/avif',
};

export type ValidatedImageInput = {
  bytes: Uint8Array;
  mimeType: string;
  extension: string;
};

function normalizeMimeType(value: string | null | undefined): string {
  return String(value || '').split(';', 1)[0].trim().toLowerCase();
}

function imageLimitError(): Error {
  return new Error(`Image exceeds the ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB size limit.`);
}

function assertImageSize(byteSize: number): void {
  if (byteSize <= 0) throw new Error('Image is empty.');
  if (byteSize > MAX_IMAGE_BYTES) throw imageLimitError();
}

function ascii(bytes: Uint8Array, start: number, length: number): string {
  let value = '';
  const end = Math.min(bytes.length, start + length);
  for (let index = start; index < end; index += 1) {
    value += String.fromCharCode(bytes[index]);
  }
  return value;
}

function sniffMimeType(bytes: Uint8Array): string | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    ascii(bytes, 1, 3) === 'PNG' &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a
  ) {
    return 'image/png';
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return 'image/jpeg';
  }
  if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 4) === 'WEBP') {
    return 'image/webp';
  }
  if (bytes.length >= 6 && ['GIF87a', 'GIF89a'].includes(ascii(bytes, 0, 6))) {
    return 'image/gif';
  }
  if (bytes.length >= 12 && ascii(bytes, 4, 4) === 'ftyp') {
    const brand = ascii(bytes, 8, 4).toLowerCase();
    if (brand === 'avif' || brand === 'avis') return 'image/avif';
  }
  return null;
}

function validateImageBytes(bytes: Uint8Array, declaredMimeType?: string): ValidatedImageInput {
  assertImageSize(bytes.byteLength);
  const detectedMimeType = sniffMimeType(bytes);
  if (!detectedMimeType) {
    throw new Error('Unsupported or invalid image. Use PNG, JPEG, WebP, GIF, or AVIF.');
  }
  const declared = normalizeMimeType(declaredMimeType);
  if (declared && declared !== detectedMimeType) {
    throw new Error(`Image content does not match its declared MIME type (${declared}).`);
  }
  return {
    bytes,
    mimeType: detectedMimeType,
    extension: MIME_EXTENSIONS[detectedMimeType],
  };
}

function parseIpv4Octets(host: string): number[] | null {
  const octets = host.split('.').map(Number);
  return octets.length === 4 &&
    octets.every((octet) => Number.isInteger(octet) && octet >= 0 && octet <= 255)
    ? octets
    : null;
}

function isNonPublicIpv4(octets: number[]): boolean {
  const [first, second, third] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    first >= 224 ||
    (first === 100 && second >= 64 && second <= 127) ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 0) ||
    (first === 192 && second === 88 && third === 99) ||
    (first === 192 && second === 168) ||
    (first === 198 && (second === 18 || second === 19)) ||
    (first === 198 && second === 51 && third === 100) ||
    (first === 203 && second === 0 && third === 113)
  );
}

function expandIpv6(host: string): number[] | null {
  const pieces = host.split('::');
  if (pieces.length > 2) return null;
  const parseSide = (side: string): number[] | null => {
    if (!side) return [];
    const groups = side.split(':');
    if (groups.some((group) => !/^[0-9a-f]{1,4}$/i.test(group))) return null;
    return groups.map((group) => Number.parseInt(group, 16));
  };
  const left = parseSide(pieces[0]);
  const right = parseSide(pieces[1] ?? '');
  if (!left || !right) return null;
  if (pieces.length === 1) return left.length === 8 ? left : null;
  const missing = 8 - left.length - right.length;
  return missing >= 1 ? [...left, ...Array<number>(missing).fill(0), ...right] : null;
}

function embeddedIpv4(groups: number[], start: number): number[] {
  return [
    groups[start] >> 8,
    groups[start] & 0xff,
    groups[start + 1] >> 8,
    groups[start + 1] & 0xff,
  ];
}

function isNonPublicIpv6(host: string): boolean {
  const groups = expandIpv6(host);
  if (!groups) return true;
  const allZeroPrefix = (length: number) => groups.slice(0, length).every((group) => group === 0);
  if (groups.every((group) => group === 0)) return true;
  if (allZeroPrefix(7) && groups[7] === 1) return true;
  if ((groups[0] & 0xfe00) === 0xfc00) return true;
  if ((groups[0] & 0xffc0) === 0xfe80 || (groups[0] & 0xffc0) === 0xfec0) return true;
  if ((groups[0] & 0xff00) === 0xff00) return true;
  if (groups[0] === 0x100 && groups.slice(1, 4).every((group) => group === 0)) return true;
  if (groups[0] === 0x2001 && groups[1] === 0x0db8) return true;
  if (groups[0] === 0x2001 && (groups[1] & 0xfff0) === 0x0010) return true;
  if (groups[0] === 0x2001 && (groups[1] & 0xfff0) === 0x0020) return true;
  if (groups[0] === 0x2001 && groups[1] === 0x0002 && groups[2] === 0) return true;
  if (groups[0] === 0x3fff && (groups[1] & 0xf000) === 0) return true;

  if (allZeroPrefix(5) && groups[5] === 0xffff) {
    return isNonPublicIpv4(embeddedIpv4(groups, 6));
  }
  if (groups[0] === 0x0064 && groups[1] === 0xff9b) {
    return isNonPublicIpv4(embeddedIpv4(groups, 6));
  }
  if (groups[0] === 0x2002) {
    return isNonPublicIpv4(embeddedIpv4(groups, 1));
  }
  if (groups[0] === 0x2001 && groups[1] === 0) return true;
  return false;
}

function isPrivateOrLocalHostname(hostname: string): boolean {
  const host = hostname.toLowerCase().replace(/[\[\]]/g, '').replace(/\.$/, '');
  if (
    host === 'localhost' ||
    host.endsWith('.localhost') ||
    host.endsWith('.local') ||
    host.endsWith('.internal') ||
    host === 'metadata' ||
    host === 'metadata.google.internal'
  ) {
    return true;
  }
  if (host.includes(':')) return isNonPublicIpv6(host);
  const octets = parseIpv4Octets(host);
  return octets ? isNonPublicIpv4(octets) : false;
}

function parseRemoteUrl(value: string): URL {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Image URL is invalid.');
  }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error('Image URL must use HTTP or HTTPS.');
  }
  if (url.username || url.password) {
    throw new Error('Image URL must not contain credentials.');
  }
  if (isPrivateOrLocalHostname(url.hostname)) {
    throw new Error('Image URL must point to a public host.');
  }
  return url;
}

async function readResponseBytes(response: Response): Promise<Uint8Array> {
  const declaredLength = Number(response.headers.get('content-length') || 0);
  if (declaredLength > MAX_IMAGE_BYTES) throw imageLimitError();
  if (!response.body) {
    const bytes = new Uint8Array(await response.arrayBuffer());
    assertImageSize(bytes.byteLength);
    return bytes;
  }

  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_IMAGE_BYTES) {
        await reader.cancel();
        throw imageLimitError();
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }

  assertImageSize(total);
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return bytes;
}

const REMOTE_IMAGE_USER_AGENT =
  'Mozilla/5.0 (compatible; open-prompts-image-fetch/1.0; +https://github.com/rudy2steiner/open-prompts)';
const REMOTE_IMAGE_BROWSER_USER_AGENT =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

function remoteImageRequestHeaders(url: URL): Record<string, string> {
  const headers: Record<string, string> = {
    accept: 'image/avif,image/webp,image/png,image/jpeg,image/gif,image/*;q=0.8',
    'user-agent': REMOTE_IMAGE_USER_AGENT,
  };
  const host = url.hostname.toLowerCase();
  if (host === 'pbs.twimg.com' || host.endsWith('.twimg.com')) {
    headers['user-agent'] = REMOTE_IMAGE_BROWSER_USER_AGENT;
    headers.referer = 'https://twitter.com/';
    headers.origin = 'https://twitter.com';
  }
  return headers;
}

function timeoutSignal(): { signal: AbortSignal; clear: () => void } {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REMOTE_IMAGE_TIMEOUT_MS);
  return { signal: controller.signal, clear: () => clearTimeout(timeout) };
}

export async function imageInputFromFile(file: File): Promise<ValidatedImageInput> {
  if (!(file instanceof File)) throw new Error('Missing image file.');
  assertImageSize(file.size);
  return validateImageBytes(new Uint8Array(await file.arrayBuffer()), file.type);
}

export function imageInputFromBytes(
  bytes: Uint8Array,
  declaredMimeType?: string,
): ValidatedImageInput {
  return validateImageBytes(bytes, declaredMimeType);
}

export function imageInputFromDataUrl(value: string): ValidatedImageInput {
  const match = /^data:([^;,]+);base64,([\s\S]+)$/i.exec(String(value || '').trim());
  if (!match) throw new Error('Invalid image data URL.');
  const base64 = match[2].replace(/\s+/g, '');
  if (!base64 || !/^[a-z0-9+/]*={0,2}$/i.test(base64)) {
    throw new Error('Invalid image Base64 data.');
  }
  const padding = base64.endsWith('==') ? 2 : base64.endsWith('=') ? 1 : 0;
  assertImageSize(Math.floor((base64.length * 3) / 4) - padding);
  const binary = globalThis.atob(base64);
  const bytes = Uint8Array.from(binary, (character) => character.charCodeAt(0));
  return validateImageBytes(bytes, match[1]);
}

export async function imageInputFromRemoteUrl(value: string): Promise<ValidatedImageInput> {
  let currentUrl = parseRemoteUrl(value);
  const { signal, clear } = timeoutSignal();
  try {
    for (let redirect = 0; redirect < 4; redirect += 1) {
      let response: Response;
      try {
        response = await fetch(currentUrl, {
          cache: 'no-store',
          redirect: 'manual',
          signal,
          headers: remoteImageRequestHeaders(currentUrl),
        });
      } catch (error: unknown) {
        if (error instanceof Error && error.name === 'AbortError') {
          throw new Error('Timed out while downloading generated image.');
        }
        throw new Error(
          `Unable to download generated image: ${error instanceof Error ? error.message : 'fetch failed'}`,
        );
      }

      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get('location');
        if (!location || redirect === 3) throw new Error('Generated image redirected too many times.');
        currentUrl = parseRemoteUrl(new URL(location, currentUrl).toString());
        continue;
      }
      if (!response.ok) throw new Error(`Unable to download generated image (${response.status}).`);

      let bytes: Uint8Array;
      try {
        bytes = await readResponseBytes(response);
      } catch (error: unknown) {
        if (signal.aborted) throw new Error('Timed out while downloading generated image.');
        throw error;
      }
      const contentType = normalizeMimeType(response.headers.get('content-type'));
      if (contentType && !contentType.startsWith('image/') && contentType !== 'application/octet-stream') {
        throw new Error(`Remote image returned an invalid content type (${contentType}).`);
      }
      const fallbackMimeType = EXTENSION_MIME_TYPES[currentUrl.pathname.split('.').pop()?.toLowerCase() || ''];
      return validateImageBytes(
        bytes,
        contentType.startsWith('image/') ? contentType : fallbackMimeType,
      );
    }
    throw new Error('Unable to download generated image.');
  } finally {
    clear();
  }
}

export async function imageInputFromProviderOutput(value: string): Promise<ValidatedImageInput> {
  const normalized = String(value || '').trim();
  if (!normalized) throw new Error('Generated image output is empty.');
  return normalized.startsWith('data:')
    ? imageInputFromDataUrl(normalized)
    : imageInputFromRemoteUrl(normalized);
}

export { MAX_IMAGE_BYTES };