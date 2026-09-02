import { getAuthSession } from '~/lib/auth/session';
import {
  AssetOwnerConfigurationError,
  resolveAssetOwner,
} from '~/lib/assets/asset-owner';
import type {
  APlusCanvasApiResponse,
  APlusCanvasEditRequest,
  APlusCanvasEditResponse,
} from '~/lib/a-plus/a-plus-domain';
import {
  A_PLUS_CANVAS_ASPECT_RATIOS,
  buildAPlusCanvasEditPrompt,
  isAPlusCanvasEditRequest,
} from '~/lib/a-plus/a-plus-domain';
import { createGeneration } from '~/lib/generation/generation-create-service';
import type { GenerationCreateResponseDto } from '~/lib/generation/generation-dto';

const MAX_CANVAS_IMAGE_CHARS = 15_000_000;
const MAX_CANVAS_INSTRUCTION_CHARS = 32_000;

function errorResponse(error: string, status: number, detail?: string) {
  const body: APlusCanvasApiResponse = detail ? { error, detail } : { error };
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function normalizeRequest(value: unknown): APlusCanvasEditRequest | null {
  if (!isAPlusCanvasEditRequest(value)) return null;
  const request = value as APlusCanvasEditRequest;
  if (request.editInstruction.length > MAX_CANVAS_INSTRUCTION_CHARS) return null;
  if (request.sellingPoints.length > 7) return null;
  return {
    ...request,
    currentImage: request.currentImage.trim(),
    sourceImage: typeof request.sourceImage === 'string' ? request.sourceImage.trim() : null,
    editInstruction: request.editInstruction,
    productName: request.productName.trim().slice(0, 200),
    category: request.category.trim().slice(0, 200),
    sellingPoints: request.sellingPoints,
  };
}

export async function POST(req: Request) {
  const payload = await req.json().catch(() => null);
  const request = normalizeRequest(payload);
  if (!request) {
    return errorResponse(
      'Invalid continuous canvas edit request.',
      400,
      'Provide a current image, a non-empty edit instruction, a supported vertical canvas ratio, and boolean edit constraints.',
    );
  }

  if (!A_PLUS_CANVAS_ASPECT_RATIOS.includes(request.aspectRatio)) {
    return errorResponse('Unsupported canvas aspect ratio.', 400);
  }
  if (request.currentImage.length > MAX_CANVAS_IMAGE_CHARS) {
    return errorResponse('Current canvas image is too large.', 413, 'Use an image smaller than 10 MB.');
  }
  if (request.sourceImage && request.sourceImage.length > MAX_CANVAS_IMAGE_CHARS) {
    return errorResponse('Source product image is too large.', 413, 'Use an image smaller than 10 MB.');
  }

  const prompt = buildAPlusCanvasEditPrompt(request);
  console.info('[op:a-plus:canvas:request]', {
    mode: 'continuous',
    aspectRatio: request.aspectRatio,
    provider: 'openai-compatible',
    model: 'gpt-image-2',
    currentImage: {
      kind: request.currentImage.startsWith('data:image/') ? 'data-url' : request.currentImage.startsWith('http') ? 'remote-url' : 'other',
      length: request.currentImage.length,
    },
    sourceImage: request.sourceImage
      ? {
          kind: request.sourceImage.startsWith('data:image/') ? 'data-url' : request.sourceImage.startsWith('http') ? 'remote-url' : 'other',
          length: request.sourceImage.length,
        }
      : null,
    sellingPointCount: request.sellingPoints.length,
    instructionLength: request.editInstruction.length,
    promptLength: prompt.length,
    promptHasCommerceContract: prompt.includes('Non-negotiable commerce asset contract:'),
    promptHasVerbatimMarker: prompt.includes('User prompt, verbatim:'),
  });
  const session = await getAuthSession();
  let assetOwner;
  try {
    assetOwner = await resolveAssetOwner({
      cookieHeader: req.headers.get('cookie') || '',
      userId: session?.user?.id ?? null,
      issueAnonymous: true,
    });
  } catch (ownerError: unknown) {
    const detail =
      ownerError instanceof AssetOwnerConfigurationError
        ? ownerError.message
        : 'Unable to establish trusted image ownership.';
    return errorResponse('Image storage is not configured.', 503, detail);
  }
  const result = await createGeneration(
    {
      provider: 'openai-compatible',
      model: 'gpt-image-2',
      prompt,
      aspectRatio: request.aspectRatio,
      quality: '2k',
      inputFidelity: request.preserveIdentity ? 'high' : 'low',
      count: 1,
      imageInputs: request.sourceImage
        ? [request.currentImage, request.sourceImage]
        : [request.currentImage],
    },
    {
      cookieHeader: req.headers.get('cookie') || '',
      assetOwner,
    },
  );

  const resultBody = result.body as GenerationCreateResponseDto | { error: string; detail?: string };
  if ('error' in resultBody) {
    return errorResponse(resultBody.error, result.status, resultBody.detail);
  }
  if (result.status >= 400) {
    return errorResponse('Canvas edit failed.', result.status);
  }

  const body = resultBody;
  const response: APlusCanvasEditResponse = {
    mode: 'edit',
    fallbackUsed: false,
    aspectRatio: request.aspectRatio,
    provider: body.provider,
    providerJobId: body.providerJobId,
    status: body.status,
    ...(body.images?.[0] ? { imageUrl: body.images[0] } : {}),
    ...(body.status === 'failed' ? { error: 'Canvas provider rejected the generation request.' } : {}),
  };

  const headers = new Headers(result.headers);
  headers.set('content-type', 'application/json');
  if (assetOwner.setCookie) headers.append('set-cookie', assetOwner.setCookie);
  return new Response(JSON.stringify(response), {
    status: result.status,
    headers,
  });
}