import { pollGeneration } from '~/lib/generation/generation-poll-service';

export async function GET(
  req: Request,
  props: { params: Promise<{ providerJobId: string }> },
) {
  const params = await props.params;
  const result = await pollGeneration({
    encodedProviderJobId: decodeURIComponent(params.providerJobId || ''),
    apiKey: req.headers.get('x-op-api-key') || '',
  });

  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { 'content-type': 'application/json' },
  });
}