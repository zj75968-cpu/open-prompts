import type {
  GenerationApiResponseDto,
  GenerationPollResponseDto,
} from '~/lib/generation/generation-dto';
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

  const body: GenerationApiResponseDto<GenerationPollResponseDto> = result.body;
  return new Response(JSON.stringify(body), {
    status: result.status,
    headers: { 'content-type': 'application/json' },
  });
}