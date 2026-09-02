import { imageInputFromRemoteUrl } from '~/lib/assets/image-input';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_PROXY_HOSTS = new Set([
  'cdn-images.toolify.ai',
  'pbs.twimg.com',
]);

function isAllowedProxyUrl(value: string): boolean {
  try {
    const url = new URL(value);
    const host = url.hostname.toLowerCase().replace(/\.$/, '');
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      (ALLOWED_PROXY_HOSTS.has(host) || host.endsWith('.twimg.com'))
    );
  } catch {
    return false;
  }
}

function errorStatus(message: string): number {
  if (/size limit|exceeds/i.test(message)) return 413;
  if (/invalid|must use|credentials|public host|unsupported/i.test(message)) return 400;
  return 502;
}

export async function GET(req: Request) {
  const url = String(new URL(req.url).searchParams.get('url') || '').trim();
  if (!url) {
    return Response.json({ error: 'Missing url' }, { status: 400 });
  }
  if (!isAllowedProxyUrl(url)) {
    return Response.json({ error: 'Remote image host is not allowed.' }, { status: 403 });
  }

  try {
    const image = await imageInputFromRemoteUrl(url);
    const body = new ArrayBuffer(image.bytes.byteLength);
    new Uint8Array(body).set(image.bytes);
    return new Response(body, {
      status: 200,
      headers: {
        'content-type': image.mimeType,
        'content-length': String(image.bytes.byteLength),
        'cache-control': 'public, max-age=3600',
        'x-content-type-options': 'nosniff',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Remote image fetch failed.';
    return Response.json(
      { error: message },
      { status: errorStatus(message) },
    );
  }
}
