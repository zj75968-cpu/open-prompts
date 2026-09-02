import { getAuthSession } from '~/lib/auth/session';
import {
  AssetOwnerConfigurationError,
  resolveAssetOwner,
} from '~/lib/assets/asset-owner';
import type {
  GenerationApiResponseDto,
  GenerationCreateRequestDto,
  GenerationCreateResponseDto,
} from '~/lib/generation/generation-dto';
import { createGeneration } from '~/lib/generation/generation-create-service';

export async function POST(req: Request) {
  const payload = (await req.json().catch(() => ({}))) as Partial<GenerationCreateRequestDto>;
  const session = await getAuthSession();
  let assetOwner;
  try {
    assetOwner = await resolveAssetOwner({
      cookieHeader: req.headers.get('cookie') || '',
      userId: session?.user?.id ?? null,
      issueAnonymous: true,
    });
  } catch (error: unknown) {
    const message =
      error instanceof AssetOwnerConfigurationError
        ? error.message
        : 'Unable to establish trusted image ownership.';
    return new Response(JSON.stringify({ error: message }), {
      status: 503,
      headers: { 'content-type': 'application/json' },
    });
  }
  const result = await createGeneration(payload, {
    cookieHeader: req.headers.get('cookie') || '',
    assetOwner,
  });

  const body: GenerationApiResponseDto<GenerationCreateResponseDto> = result.body;
  const headers = new Headers(result.headers);
  headers.set('content-type', 'application/json');
  if (assetOwner.setCookie) headers.append('set-cookie', assetOwner.setCookie);
  return new Response(JSON.stringify(body), {
    status: result.status,
    headers,
  });
}