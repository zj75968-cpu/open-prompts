import { localeApiPath } from '~/lib/locale-api-path';
import {
  createGenerationJob,
  pollGenerationJob,
} from '~/lib/generation/generation-api-client';
import { isGenerationErrorResponse } from '~/lib/generation/generation-dto';
import type { GenerationPollResponseDto } from '~/lib/generation/generation-dto';
import { buildAPlusModulePrompt } from '~/lib/a-plus/a-plus-domain';
import type { APlusInput, APlusModulePlan } from '~/lib/a-plus/a-plus-domain';

const DEFAULT_PROVIDER = 'openai-compatible';
const DEFAULT_MODEL = 'gpt-image-2';
const DEFAULT_QUALITY = '2k';
const POLL_INTERVAL_MS = 2000;
const MAX_POLLS = 90;

type APlusGenerationRequest = {
  locale: string;
  input: APlusInput;
  module: APlusModulePlan;
};

function errorMessage(value: unknown, fallback: string): string {
  return isGenerationErrorResponse(value) && value.error ? value.error : fallback;
}

export function aPlusImageUrl(locale: string, value: string): string {
  const url = String(value || '').trim();
  if (!url) return '';
  if (url.startsWith('/') && !url.startsWith('//')) return url;
  if (!/^https?:\/\//i.test(url)) return url;
  return `${localeApiPath(locale, '/api/image-proxy')}?url=${encodeURIComponent(url)}`;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => window.setTimeout(resolve, ms));
}

export async function generateAPlusModule({
  locale,
  input,
  module,
}: APlusGenerationRequest): Promise<{ imageUrl: string; providerJobId: string }> {
  const prompt = buildAPlusModulePrompt(input, module);
  const response = await createGenerationJob(locale, {
    provider: DEFAULT_PROVIDER,
    prompt,
    model: DEFAULT_MODEL,
    aspectRatio: module.aspectRatio,
    quality: DEFAULT_QUALITY,
    count: 1,
    referenceImages: input.sourceImage ? [input.sourceImage] : undefined,
  });

  if (!response.ok || isGenerationErrorResponse(response.data)) {
    throw new Error(errorMessage(response.data, `Failed to create ${module.id}`));
  }

  const providerJobId = response.data.providerJobId;
  if (!providerJobId) throw new Error(`Missing job id for ${module.id}`);

  if (response.data.status === 'succeeded' && response.data.images?.[0]) {
    return { imageUrl: response.data.images[0], providerJobId };
  }

  for (let poll = 0; poll < MAX_POLLS; poll += 1) {
    await sleep(POLL_INTERVAL_MS);
    const result = await pollGenerationJob(locale, providerJobId);
    if (!result.ok || isGenerationErrorResponse(result.data)) {
      throw new Error(errorMessage(result.data, `Failed to poll ${module.id}`));
    }

    const payload = result.data as GenerationPollResponseDto;
    if (payload.status === 'succeeded' && payload.images?.[0]) {
      return { imageUrl: payload.images[0], providerJobId };
    }
    if (payload.status === 'failed') {
      throw new Error(payload.error || `${module.id} generation failed`);
    }
  }

  throw new Error(`${module.id} generation timed out`);
}

export function triggerDownload(url: string, filename: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.target = '_blank';
  link.rel = 'noreferrer';
  document.body.appendChild(link);
  link.click();
  link.remove();
}