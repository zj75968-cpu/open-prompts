import type {
  GenerationApiResponseDto,
  GenerationCreateRequestDto,
  GenerationCreateResponseDto,
} from '~/lib/generation/generation-dto';
import { createGeneration } from '~/lib/generation/generation-create-service';

export async function POST(req: Request) {
  const payload = (await req.json().catch(() => ({}))) as Partial<GenerationCreateRequestDto>;
  const result = await createGeneration(payload, {
    cookieHeader: req.headers.get('cookie') || '',
    userId: (req.headers.get('x-op-user-id') || '').trim(),
  });

  const body: GenerationApiResponseDto<GenerationCreateResponseDto> = result.body;
  return new Response(JSON.stringify(body), {
    status: result.status,
    headers: {
      'content-type': 'application/json',
      ...result.headers,
    },
  });
}