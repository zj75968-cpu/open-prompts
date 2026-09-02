import type {
  GenerationCreateParams,
  GenerationCreateResult,
  GenerationPollResult,
  ImageGenerationProvider,
} from '~/lib/generation/types';
import { getGenerationImageInputs } from '~/lib/generation/image-input';

type AtlascloudCreateResponse = {
  id?: string;
  status?: string;
  data?: {
    id?: string;
    status?: string;
  };
};

type AtlascloudPollResponse = {
  status?: string;
  outputs?: unknown;
  images?: unknown;
  output?: unknown;
  error?: unknown;
  data?: {
    id?: string;
    status?: string;
    outputs?: unknown;
    error?: unknown;
    output?: unknown;
    images?: unknown;
  };
};

function mapStatus(status: string | undefined): GenerationCreateResult['status'] {
  const normalized = String(status || '').trim().toLowerCase();
  if (
    normalized === 'succeeded' ||
    normalized === 'success' ||
    normalized === 'completed' ||
    normalized === 'complete' ||
    normalized === 'done' ||
    normalized.includes('succeed') ||
    normalized.includes('complete')
  ) {
    return 'succeeded';
  }
  if (
    normalized === 'failed' ||
    normalized === 'failure' ||
    normalized === 'error' ||
    normalized === 'canceled' ||
    normalized === 'cancelled' ||
    normalized.includes('fail') ||
    normalized.includes('error') ||
    normalized.includes('cancel')
  ) {
    return 'failed';
  }
  if (
    normalized === 'running' ||
    normalized === 'processing' ||
    normalized === 'in_progress' ||
    normalized === 'in-progress' ||
    normalized === 'generating' ||
    normalized.includes('process') ||
    normalized.includes('run') ||
    normalized.includes('start')
  ) {
    return 'running';
  }
  return 'queued';
}

function imageValue(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (!value || typeof value !== 'object') return null;
  const item = value as { url?: unknown; image_url?: unknown; b64_json?: unknown };
  if (typeof item.url === 'string' && item.url.trim()) return item.url.trim();
  if (typeof item.image_url === 'string' && item.image_url.trim()) return item.image_url.trim();
  if (typeof item.b64_json === 'string' && item.b64_json.trim()) {
    return `data:image/png;base64,${item.b64_json.trim()}`;
  }
  return null;
}

function imageList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.flatMap((item) => {
      const direct = imageValue(item);
      if (direct) return [direct];
      if (item && typeof item === 'object') {
        const nested = item as { images?: unknown; output?: unknown; outputs?: unknown };
        return [
          ...imageList(nested.images),
          ...imageList(nested.output),
          ...imageList(nested.outputs),
        ];
      }
      return [];
    });
  }

  const direct = imageValue(value);
  if (direct) return [direct];
  if (!value || typeof value !== 'object') return [];
  const nested = value as { images?: unknown; output?: unknown; outputs?: unknown };
  return [
    ...imageList(nested.images),
    ...imageList(nested.output),
    ...imageList(nested.outputs),
  ];
}

function extractPollImages(json: AtlascloudPollResponse): string[] | undefined {
  const images = [
    ...imageList(json.outputs),
    ...imageList(json.images),
    ...imageList(json.output),
    ...imageList(json.data?.outputs),
    ...imageList(json.data?.images),
    ...imageList(json.data?.output),
  ];
  const unique = Array.from(new Set(images));
  return unique.length ? unique : undefined;
}

export function createAtlascloudProvider(): ImageGenerationProvider {
  return createAtlascloudProviderWithOptions();
}

function pickAtlasSize(aspectRatio?: string): { width: number; height: number } | undefined {
  const ar = String(aspectRatio || '').trim();
  if (!ar) return undefined;
  const norm = ar.replace(/\s+/g, '');
  // AtlasCloud doc highlights common fixed sizes:
  // 1024×1024, 1024×1536, 1536×1024
  if (norm === '1:1' || norm === '1/1') return { width: 1024, height: 1024 };
  // Portrait-like ratios
  if (norm === '9:16' || norm === '2:3' || norm === '3:4' || norm === '4:5') return { width: 1024, height: 1536 };
  // Landscape-like ratios
  if (norm === '16:9' || norm === '3:2' || norm === '4:3' || norm === '5:4' || norm === '2:1')
    return { width: 1536, height: 1024 };
  return undefined;
}

function coerceQuality(q?: string): 'low' | 'medium' | 'high' | undefined {
  const s = String(q || '').toLowerCase();
  if (!s) return undefined;
  if (s === 'low' || s === 'medium' || s === 'high') return s;
  // our UI uses "1k" by default
  if (s.includes('1k')) return 'medium';
  if (s.includes('2k') || s.includes('4k')) return 'high';
  return undefined;
}

export function createAtlascloudProviderWithOptions(opts?: { baseUrl?: string; apiKey?: string }): ImageGenerationProvider {
  const baseUrl = opts?.baseUrl ?? process.env.ATLASCLOUD_BASE_URL;
  const apiKey = opts?.apiKey ?? process.env.ATLASCLOUD_API_KEY;

  if (!baseUrl) throw new Error('Missing ATLASCLOUD_BASE_URL');
  if (!apiKey) throw new Error('Missing ATLASCLOUD_API_KEY');

  const base = baseUrl.replace(/\/+$/, '');
  // Accept multiple user-provided baseUrl styles:
  // - https://api.atlascloud.ai
  // - https://api.atlascloud.ai/api
  // - https://api.atlascloud.ai/api/v1/model
  const modelBase = /\/api\/v1\/model$/.test(base)
    ? base
    : /\/api$/.test(base)
      ? `${base}/v1/model`
      : `${base}/api/v1/model`;
  const createUrl = `${modelBase}/generateImage`;
  const pollUrlBase = `${modelBase}/prediction`;

  return {
    provider: 'atlascloud',
    async create(params: GenerationCreateParams): Promise<GenerationCreateResult> {
      const modelSlug =
        params.model && params.model.includes('/') ? params.model : 'openai/gpt-image-2/text-to-image';
      const size = pickAtlasSize(params.aspectRatio);
      const quality = coerceQuality(params.quality);
      const imageInputs = getGenerationImageInputs(params);
      const referenceImageField =
        String(process.env.ATLASCLOUD_REFERENCE_IMAGE_FIELD || 'image_urls').trim() ||
        'image_urls';
      const input: Record<string, unknown> = { prompt: params.prompt };
      if (params.negativePrompt) input.negative_prompt = params.negativePrompt;
      if (imageInputs.length) input[referenceImageField] = imageInputs;

      const startedAt = Date.now();
      console.info('[op:provider:atlascloud:create:start]', {
        model: modelSlug,
        aspectRatio: params.aspectRatio,
        quality: params.quality,
        pickedSize: size || null,
      });
      const res = await fetch(createUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          // AtlasCloud docs show both `prompt` and `input.prompt` across examples.
          // Send both for compatibility.
          model: modelSlug,
          prompt: params.prompt,
          input,
          ...(size ? size : {}),
          ...(quality ? { quality } : {}),
        }),
      });

      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        console.error('[op:provider:atlascloud:create:error]', {
          status: res.status,
          elapsedMs: Date.now() - startedAt,
          bodyPreview: txt.slice(0, 800),
        });
        throw new Error(`atlascloud create failed: ${res.status} ${txt}`);
      }

      const json = (await res.json()) as AtlascloudCreateResponse;
      const id = json.data?.id || json.id;
      if (!id) throw new Error('atlascloud create: missing id');
      console.info('[op:provider:atlascloud:create:done]', {
        status: json.data?.status || json.status,
        providerJobId: id,
        elapsedMs: Date.now() - startedAt,
      });
      return { providerJobId: id, status: mapStatus(json.data?.status || json.status) };
    },
    async poll(providerJobId: string): Promise<GenerationPollResult> {
      const startedAt = Date.now();
      const res = await fetch(`${pollUrlBase}/${providerJobId}`, {
        headers: { authorization: `Bearer ${apiKey}` },
        cache: 'no-store',
      });
      if (!res.ok) {
        const txt = await res.text().catch(() => '');
        console.error('[op:provider:atlascloud:poll:error]', {
          providerJobId,
          status: res.status,
          elapsedMs: Date.now() - startedAt,
          bodyPreview: txt.slice(0, 800),
        });
        return { providerJobId, status: 'failed', error: `atlascloud poll failed: ${res.status} ${txt}` };
      }
      const json = (await res.json()) as AtlascloudPollResponse;
      const status = mapStatus(json.data?.status || json.status);
      const images = status === 'succeeded' ? extractPollImages(json) : undefined;
      const error = status === 'failed' ? String(json.data?.error ?? json.error ?? 'failed') : undefined;
      console.info('[op:provider:atlascloud:poll:done]', {
        providerJobId,
        rawStatus: json.data?.status || json.status,
        status,
        images: Array.isArray(images) ? images.length : 0,
        hasError: Boolean(error),
        elapsedMs: Date.now() - startedAt,
      });
      return { providerJobId, status, images, error };
    },
  };
}

