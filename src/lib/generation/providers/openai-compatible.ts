import {
  getGenerationImageInputs,
  imageFilename,
  imageInputToBlob,
  MAX_GENERATION_REFERENCE_IMAGES,
} from '~/lib/generation/image-input';
import type {
  GenerationCreateParams,
  GenerationCreateResult,
  GenerationPollResult,
  ImageGenerationProvider,
} from '~/lib/generation/types';

type ImagePayload = {
  url?: unknown;
  b64_json?: unknown;
  image_url?: unknown;
};

type OpenAIImageResponse = {
  data?: unknown;
  images?: unknown;
  output?: unknown;
  error?: unknown;
};

function endpointFromBaseUrl(baseUrl: string) {
  const base = baseUrl.replace(/\/+$/, '');
  if (/\/v1\/images\/generations$/i.test(base)) return base;
  if (/\/v1$/i.test(base)) return `${base}/images/generations`;
  return `${base}/v1/images/generations`;
}

function editEndpointFromBaseUrl(baseUrl: string) {
  const base = baseUrl.replace(/\/+$/, '');
  if (/\/v1\/images\/edits$/i.test(base)) return base;
  if (/\/v1\/images\/generations$/i.test(base)) return base.replace(/generations$/i, 'edits');
  if (/\/v1$/i.test(base)) return `${base}/images/edits`;
  return `${base}/v1/images/edits`;
}

function imageSize(aspectRatio?: string) {
  const ratio = String(aspectRatio || '').replace(/\s+/g, '');
  if (['9:16', '2:3', '3:4', '4:5'].includes(ratio)) return '1024x1536';
  if (['16:9', '3:2', '4:3', '5:4', '2:1'].includes(ratio)) return '1536x1024';
  return '1024x1024';
}

function imageQuality(quality?: string) {
  const value = String(quality || '').trim().toLowerCase();
  if (value === '4k' || value === '2k' || value === 'high') return 'high';
  if (value === 'low') return 'low';
  return 'medium';
}

function dataUrl(value: unknown) {
  return typeof value === 'string' && value.trim()
    ? `data:image/png;base64,${value.trim()}`
    : null;
}

function stringUrl(value: unknown) {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (value && typeof value === 'object') {
    const nested = (value as { url?: unknown }).url;
    return typeof nested === 'string' && nested.trim() ? nested.trim() : null;
  }
  return null;
}

function imageFromPayload(value: unknown) {
  if (typeof value === 'string') return value.trim() || null;
  if (!value || typeof value !== 'object') return null;
  const payload = value as ImagePayload;
  return stringUrl(payload.url) || stringUrl(payload.image_url) || dataUrl(payload.b64_json);
}

function imageArray(value: unknown) {
  if (!Array.isArray(value)) return [];
  return value.map(imageFromPayload).filter((image): image is string => Boolean(image));
}

function extractImages(response: OpenAIImageResponse) {
  const dataImages = imageArray(response.data);
  if (dataImages.length) return dataImages;

  const directImages = imageArray(response.images);
  if (directImages.length) return directImages;

  if (Array.isArray(response.output)) return imageArray(response.output);
  const outputImage = imageFromPayload(response.output);
  return outputImage ? [outputImage] : [];
}

function providerErrorMessage(error: unknown) {
  if (typeof error === 'string') return error;
  if (!error || typeof error !== 'object') return null;
  const value = error as { message?: unknown; error?: unknown };
  if (typeof value.message === 'string' && value.message.trim()) return value.message.trim();
  if (typeof value.error === 'string' && value.error.trim()) return value.error.trim();
  return null;
}

async function responseError(response: Response) {
  const text = await response.text().catch(() => '');
  if (!text) return response.statusText || 'empty response';
  try {
    const json = JSON.parse(text) as { error?: unknown; message?: unknown };
    return (
      providerErrorMessage(json.error) ||
      (typeof json.message === 'string' ? json.message : null) ||
      text.slice(0, 800)
    );
  } catch {
    return text.slice(0, 800);
  }
}

function requestPrompt(params: GenerationCreateParams) {
  const negativePrompt = String(params.negativePrompt || '').trim();
  return negativePrompt
    ? `${params.prompt}\n\nAvoid the following elements: ${negativePrompt}`
    : params.prompt;
}

const PROVIDER_REQUEST_TIMEOUT_MS = 180_000;

async function fetchWithTimeout(
  input: string,
  init: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_REQUEST_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error: unknown) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new Error('OpenAI-compatible image generation timed out.');
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function createEditResponse(args: {
  endpoint: string;
  apiKey: string;
  model: string;
  params: GenerationCreateParams;
  imageInputs: string[];
}): Promise<Response> {
  const form = new FormData();
  form.set('model', args.model);
  form.set('prompt', requestPrompt(args.params));
  form.set('n', String(Math.max(1, Math.min(10, Math.floor(args.params.count || 1)))));
  form.set('size', imageSize(args.params.aspectRatio));
  form.set('quality', imageQuality(args.params.quality));

  const blobs = await Promise.all(args.imageInputs.map((imageInput) => imageInputToBlob(imageInput)));
  const imageField = args.imageInputs.length === 1 ? 'image' : 'image[]';
  blobs.forEach((blob, index) => {
    form.append(imageField, blob, imageFilename(args.imageInputs[index], index));
  });
  return fetchWithTimeout(args.endpoint, {
    method: 'POST',
    headers: { authorization: `Bearer ${args.apiKey}` },
    body: form,
  });
}

function requestId() {
  return (
    globalThis.crypto?.randomUUID?.() ||
    `sync_${Date.now()}_${Math.random().toString(16).slice(2)}`
  );
}

export function createOpenAICompatibleProvider(): ImageGenerationProvider {
  const baseUrl = String(process.env.OPENAI_IMAGE_BASE_URL || '').trim();
  const apiKey = String(process.env.OPENAI_IMAGE_API_KEY || '').trim();
  const configuredModel = String(process.env.OPENAI_IMAGE_MODEL || '').trim();

  if (!baseUrl) throw new Error('Missing OPENAI_IMAGE_BASE_URL');
  if (!apiKey) throw new Error('Missing OPENAI_IMAGE_API_KEY');

  const endpoint = endpointFromBaseUrl(baseUrl);
  const editEndpoint = editEndpointFromBaseUrl(baseUrl);

  return {
    provider: 'openai-compatible',
    async create(params: GenerationCreateParams): Promise<GenerationCreateResult> {
      const model = configuredModel || String(params.model || '').trim() || 'gpt-image-2';
      const startedAt = Date.now();
      const imageInputs = getGenerationImageInputs(params);
      if (imageInputs.length > MAX_GENERATION_REFERENCE_IMAGES) {
        throw new Error(
          `A maximum of ${MAX_GENERATION_REFERENCE_IMAGES} reference images is supported.`,
        );
      }
      const response = imageInputs.length
        ? await createEditResponse({
            endpoint: editEndpoint,
            apiKey,
            model,
            params,
            imageInputs,
          })
        : await fetchWithTimeout(endpoint, {
            method: 'POST',
            headers: {
              'content-type': 'application/json',
              authorization: `Bearer ${apiKey}`,
            },
            body: JSON.stringify({
              model,
              prompt: requestPrompt(params),
              n: Math.max(1, Math.min(4, Math.floor(params.count || 1))),
              size: imageSize(params.aspectRatio),
              quality: imageQuality(params.quality),
            }),
          });

      if (!response.ok) {
        throw new Error(
          `OpenAI-compatible image generation failed (${response.status}): ${await responseError(response)}`,
        );
      }

      const result = (await response.json()) as OpenAIImageResponse;
      const explicitError = providerErrorMessage(result.error);
      if (explicitError) {
        throw new Error(`OpenAI-compatible image generation failed: ${explicitError}`);
      }

      const images = extractImages(result);
      if (!images.length) {
        const keys = Object.keys(result).sort().join(', ') || 'none';
        throw new Error(`OpenAI-compatible image response contained no image (keys: ${keys})`);
      }

      console.info('[op:provider:openai-compatible:create:done]', {
        model,
        images: images.length,
        elapsedMs: Date.now() - startedAt,
      });
      return {
        providerJobId: requestId(),
        status: 'succeeded',
        images,
      };
    },
    async poll(providerJobId: string): Promise<GenerationPollResult> {
      return {
        providerJobId,
        status: 'failed',
        error: 'OpenAI-compatible image generation completes in the create request.',
      };
    },
  };
}