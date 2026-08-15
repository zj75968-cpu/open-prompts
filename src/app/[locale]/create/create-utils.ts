import { localeApiPath } from '~/lib/locale-api-path';

export function parseAspectRatio(value: string): number {
  const [a, b] = String(value).split(':').map((x) => Number(x));
  if (!a || !b) return 1;
  return a / b;
}

export function pickClosestAspectRatio(width: number, height: number, options: string[]) {
  const ratio = width > 0 && height > 0 ? width / height : 1;
  let best = options[0] || '1:1';
  let bestScore = Number.POSITIVE_INFINITY;

  for (const opt of options) {
    const optionRatio = parseAspectRatio(opt);
    const score = Math.abs(Math.log(ratio / optionRatio));
    if (score < bestScore) {
      bestScore = score;
      best = opt;
    }
  }

  return best;
}

export function proxifyImageUrl(locale: string, url: string) {
  const source = String(url || '');
  if (/^https?:\/\//i.test(source)) {
    return `${localeApiPath(locale, '/api/image-proxy')}?url=${encodeURIComponent(source)}`;
  }
  return source;
}

export function proxifyImageList(locale: string, list: string[]) {
  return list.map((url) => proxifyImageUrl(locale, url));
}

function extensionFromImageUrl(url: string) {
  try {
    const parsed = new URL(url, 'http://local');
    const match = (parsed.pathname || '').match(/\.(png|jpg|jpeg|webp|gif)$/i);
    if (match?.[1]) return match[1].toLowerCase() === 'jpeg' ? 'jpg' : match[1].toLowerCase();
  } catch {
    // URL parsing is best-effort; generated images commonly omit extensions.
  }
  return 'png';
}

export async function downloadImageWithRandomName(locale: string, url: string) {
  const original = String(url || '').trim();
  if (!original) return;

  const src = proxifyImageUrl(locale, original);
  const randomId =
    globalThis.crypto?.randomUUID?.() || `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const filename = `op_${randomId}.${extensionFromImageUrl(original)}`;

  const res = await fetch(src, { cache: 'no-store' });
  if (!res.ok) throw new Error(`download failed: ${res.status}`);

  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = blobUrl;
    anchor.download = filename;
    anchor.rel = 'noreferrer';
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
  } finally {
    URL.revokeObjectURL(blobUrl);
  }
}