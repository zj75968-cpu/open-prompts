import { getAuthSession } from '~/lib/auth/session';
import { resolveAssetOwner } from '~/lib/assets/asset-owner';
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
  const session = await getAuthSession();
  const assetOwner = await resolveAssetOwner({
    cookieHeader: req.headers.get('cookie') || '',
    userId: session?.user?.id ?? null,
    issueAnonymous: false,
  }).catch(() => ({ ownerId: null, authorizedOwnerIds: [] }));
  const result = await pollGeneration({
    encodedProviderJobId: decodeURIComponent(params.providerJobId || ''),
    apiKey: req.headers.get('x-op-api-key') || '',
    assetOwner,
  });

  const body: GenerationApiResponseDto<GenerationPollResponseDto> = result.body;
  return new Response(JSON.stringify(body), {
    status: result.status,
    headers: { 'content-type': 'application/json' },
  });
}