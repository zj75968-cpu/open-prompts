import { resolvePromptCategory, type SubmitCategoryKey, SUBMIT_CATEGORY_TAGS } from '~/lib/prompts/prompt-categories';

export type PromptAssetProvider = 'openai' | 'midjourney' | 'stable-diffusion' | 'flux' | 'gemini' | 'seedream';

export type PromptAssetParams = {
  size?: string;
  seed?: string;
  guidanceScale?: number;
  steps?: number;
};

export type PromptAsset = {
  title: string;
  description: string;
  prompt: string;
  negativePrompt?: string;
  imageUrl: string;
  images: string[];
  provider: PromptAssetProvider;
  model: string;
  category?: SubmitCategoryKey | null;
  tags: string[];
  style: string[];
  useCase: string[];
  params?: PromptAssetParams;
  license?: string;
  sourceUrl?: string;
  authorHandle?: string;
  createdAt?: string;
};

export type ImportedPromptRecord = {
  title?: unknown;
  description?: unknown;
  prompt?: unknown;
  negativePrompt?: unknown;
  negative_prompt?: unknown;
  tags?: unknown;
  style?: unknown;
  useCase?: unknown;
  use_case?: unknown;
  user_name?: unknown;
  authorHandle?: unknown;
  source_url?: unknown;
  sourceUrl?: unknown;
  images?: unknown;
  local_images?: unknown;
  remote_images?: unknown;
  imageUrl?: unknown;
  image_url?: unknown;
  provider?: unknown;
  model?: unknown;
  license?: unknown;
  params?: unknown;
};

export type PromptGalleryItemInput = {
  id: string;
  title: string;
  description: string;
  prompt: string;
  templateId?: string;
  model: string;
  category?: SubmitCategoryKey | null;
  tags: string[];
  sourceUrl?: string;
  authorHandle?: string;
  createdAt?: string;
  images: string[];
};

export type PromptSeedRowInput = {
  slug: string;
  title: string;
  description: string;
  prompt: string;
  templateId: string;
  model: string;
  category: SubmitCategoryKey | null;
  tags: string[];
  sourceUrl: string | null;
  authorHandle: string | null;
  images: string[];
  sortOrder: number;
};

const DEFAULT_PROVIDER: PromptAssetProvider = 'openai';
const DEFAULT_MODEL = 'GPT Image 2';
const DEFAULT_TEMPLATE_ID = 'japanese-fuji-film-portrait';

const STYLE_HINTS = uniqueStrings([
  ...SUBMIT_CATEGORY_TAGS.artStyles,
  'Cinematic',
  'Editorial',
  'Vintage',
  'Monochrome',
  'Film',
  'Abstract',
  'Photorealistic',
  'Documentary Photography',
  'Fashion Photography',
  'Anime',
  'Manga',
  'Watercolor',
  'Sketch',
  'Surrealism',
  'Minimalism',
  'Chinese Painting',
]);

const USE_CASE_HINTS = uniqueStrings([
  ...SUBMIT_CATEGORY_TAGS.designUi,
  ...SUBMIT_CATEGORY_TAGS.productCommercial,
  'Social Media Post',
  'Concept Art',
  'Character Design',
  'Landscape',
  'Cityscape',
  'Environment',
  'Portrait',
]);

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asString(value: unknown): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return uniqueStrings(
    value
      .map((entry) => asString(entry))
      .filter((entry): entry is string => typeof entry === 'string'),
  );
}

function uniqueStrings(values: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const value of values) {
    const next = value.trim();
    if (!next || seen.has(next)) continue;
    seen.add(next);
    out.push(next);
  }
  return out;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .trim()
    .replace(/["']/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function mergeStringLists(...lists: readonly string[][]): string[] {
  return uniqueStrings(lists.flatMap((list) => list));
}

function inferTextMatches(texts: readonly string[], keywords: readonly string[]): string[] {
  const haystack = texts.map((text) => text.toLowerCase());
  const out: string[] = [];
  for (const keyword of keywords) {
    const needle = keyword.toLowerCase();
    if (!needle) continue;
    if (haystack.some((text) => text.includes(needle))) out.push(keyword);
  }
  return uniqueStrings(out);
}

function parsePromptParams(prompt: string): PromptAssetParams | undefined {
  const params: PromptAssetParams = {};

  const arMatch = prompt.match(/(?:^|\s)--ar\s+([0-9]+(?::[0-9]+)?)/i);
  if (arMatch?.[1]) params.size = arMatch[1];

  const seedMatch = prompt.match(/(?:^|\s)--seed\s+(\d+)/i);
  if (seedMatch?.[1]) params.seed = seedMatch[1];

  const guidanceMatch = prompt.match(/(?:^|\s)--(?:cfg|guidance(?:-scale)?)\s+([0-9]+(?:\.[0-9]+)?)/i);
  if (guidanceMatch?.[1]) params.guidanceScale = Number(guidanceMatch[1]);

  const stepsMatch = prompt.match(/(?:^|\s)--steps\s+(\d+)/i);
  if (stepsMatch?.[1]) params.steps = Number(stepsMatch[1]);

  return Object.keys(params).length > 0 ? params : undefined;
}

function inferCreatedAt(imageUrls: readonly string[]): string | undefined {
  for (const url of imageUrls) {
    const match = url.match(/\/x\/(\d{4})(\d{2})(\d{2})\//);
    if (match) return `${match[1]}-${match[2]}-${match[3]}T12:00:00.000Z`;
  }
  return undefined;
}

function pickImageUrls(record: Record<string, unknown>): string[] {
  const combined = mergeStringLists(
    asStringArray(record.images),
    asStringArray(record.local_images),
    asStringArray(record.remote_images),
  );
  const single = asString(record.imageUrl) ?? asString(record.image_url);
  return uniqueStrings([...(single ? [single] : []), ...combined]);
}

function pickString(...values: unknown[]): string {
  for (const value of values) {
    const next = asString(value);
    if (next) return next;
  }
  return '';
}

function inferCategory(tags: readonly string[]): SubmitCategoryKey | null {
  return resolvePromptCategory(null, tags);
}

function inferStyle(record: Record<string, unknown>, tags: readonly string[]): string[] {
  return inferTextMatches(
    [pickString(record.title), pickString(record.description), pickString(record.prompt), ...tags],
    STYLE_HINTS,
  );
}

function inferUseCase(record: Record<string, unknown>, tags: readonly string[]): string[] {
  return inferTextMatches(
    [pickString(record.title), pickString(record.description), pickString(record.prompt), ...tags],
    USE_CASE_HINTS,
  );
}

export function normalizeImportedPromptAsset(
  raw: ImportedPromptRecord,
  index: number,
  defaults?: { provider?: PromptAssetProvider; model?: string },
): PromptAsset | null {
  if (!isRecord(raw)) return null;

  const title = pickString(raw.title, `Untitled ${index + 1}`);
  const description = pickString(raw.description);
  const prompt = pickString(raw.prompt);
  const negativePrompt = pickString(raw.negativePrompt, raw.negative_prompt) || undefined;
  const tags = asStringArray(raw.tags);
  const images = pickImageUrls(raw);
  const imageUrl = images[0] ?? '';
  const provider = (asString(raw.provider) as PromptAssetProvider | undefined) ?? defaults?.provider ?? DEFAULT_PROVIDER;
  const model = pickString(raw.model, defaults?.model ?? DEFAULT_MODEL);
  const sourceUrl = pickString(raw.source_url, raw.sourceUrl) || undefined;
  const authorHandle = pickString(raw.user_name, raw.authorHandle) || undefined;
  const category = inferCategory(tags);
  const style = uniqueStrings([...asStringArray(raw.style), ...inferStyle(raw, tags)]);
  const useCase = uniqueStrings([...asStringArray(raw.useCase), ...asStringArray(raw.use_case), ...inferUseCase(raw, tags)]);
  const paramsFromRaw = isRecord(raw.params) ? raw.params : undefined;
  const paramsFromPrompt = parsePromptParams(prompt);
  const params: PromptAssetParams = {
    ...(paramsFromPrompt ?? {}),
  };

  const size = asString(paramsFromRaw?.size);
  const seed = asString(paramsFromRaw?.seed);
  const guidanceScale = typeof paramsFromRaw?.guidanceScale === 'number' ? paramsFromRaw.guidanceScale : undefined;
  const steps = typeof paramsFromRaw?.steps === 'number' ? paramsFromRaw.steps : undefined;

  if (size) params.size = size;
  if (seed) params.seed = seed;
  if (typeof guidanceScale === 'number' && Number.isFinite(guidanceScale)) params.guidanceScale = guidanceScale;
  if (typeof steps === 'number' && Number.isFinite(steps)) params.steps = steps;

  const asset: PromptAsset = {
    title,
    description,
    prompt,
    imageUrl,
    images,
    provider,
    model,
    category,
    tags,
    style,
    useCase,
  };

  if (negativePrompt) asset.negativePrompt = negativePrompt;
  const license = asString(raw.license);
  if (license) asset.license = license;
  if (sourceUrl) asset.sourceUrl = sourceUrl;
  if (authorHandle) asset.authorHandle = authorHandle;
  const createdAt = inferCreatedAt(images);
  if (createdAt) asset.createdAt = createdAt;
  if (Object.keys(params).length > 0) asset.params = params;

  return asset;
}

export function normalizeImportedPromptAssets(
  rawAssets: readonly unknown[],
  defaults?: { provider?: PromptAssetProvider; model?: string },
): PromptAsset[] {
  const out: PromptAsset[] = [];
  for (let index = 0; index < rawAssets.length; index += 1) {
    const raw = rawAssets[index];
    const asset = normalizeImportedPromptAsset(raw as ImportedPromptRecord, index, defaults);
    if (asset) out.push(asset);
  }
  return out;
}

export function promptAssetToGalleryItem(asset: PromptAsset, index: number): PromptGalleryItemInput {
  const base = slugify(asset.title) || `prompt-${index + 1}`;
  const id = `${base}-${index + 1}`;
  return {
    id,
    title: asset.title,
    description: asset.description,
    prompt: asset.prompt,
    templateId: DEFAULT_TEMPLATE_ID,
    model: asset.model,
    category: asset.category ?? null,
    tags: asset.tags,
    sourceUrl: asset.sourceUrl,
    authorHandle: asset.authorHandle,
    createdAt: asset.createdAt,
    images: asset.images,
  };
}

export function promptAssetToSeedRow(asset: PromptAsset, index: number): PromptSeedRowInput {
  const base = slugify(asset.title) || `prompt-${index + 1}`;
  const slug = `${base}-${index + 1}`;
  return {
    slug,
    title: asset.title,
    description: asset.description,
    prompt: asset.prompt,
    templateId: DEFAULT_TEMPLATE_ID,
    model: asset.model,
    category: asset.category ?? null,
    tags: asset.tags,
    sourceUrl: asset.sourceUrl ?? null,
    authorHandle: asset.authorHandle ?? null,
    images: asset.images,
    sortOrder: index,
  };
}