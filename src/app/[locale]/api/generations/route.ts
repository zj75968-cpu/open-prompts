import { createGeneration } from '~/lib/generation/generation-create-service';

export async function POST(req: Request) {
  const payload = await req.json().catch(() => ({}));
  const result = await createGeneration(payload, {
    cookieHeader: req.headers.get('cookie') || '',
    userId: (req.headers.get('x-op-user-id') || '').trim(),
  });

  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: {
      'content-type': 'application/json',
      ...result.headers,
    },
  });
}