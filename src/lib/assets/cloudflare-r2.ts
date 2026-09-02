import { getCloudflareContext } from '@opennextjs/cloudflare';

export type ImageAssetsR2Object = {
  body: ReadableStream<Uint8Array>;
  size: number;
  httpEtag: string;
  customMetadata?: Record<string, string>;
};

export type ImageAssetsBucket = {
  put(
    key: string,
    value: ArrayBuffer | ArrayBufferView | ReadableStream,
    options?: {
      httpMetadata?: { contentType?: string; cacheControl?: string };
      customMetadata?: Record<string, string>;
    },
  ): Promise<unknown>;
  get(key: string): Promise<ImageAssetsR2Object | null>;
  delete(key: string): Promise<void>;
};

declare global {
  interface CloudflareEnv {
    IMAGE_ASSETS?: ImageAssetsBucket;
  }
}

export class ImageAssetConfigurationError extends Error {
  constructor(message = 'Cloudflare R2 binding IMAGE_ASSETS is not configured.') {
    super(message);
    this.name = 'ImageAssetConfigurationError';
  }
}

export async function getImageAssetsBucket(): Promise<ImageAssetsBucket> {
  try {
    const { env } = await getCloudflareContext({ async: true });
    const bucket = env.IMAGE_ASSETS;
    if (!bucket) throw new ImageAssetConfigurationError();
    return bucket;
  } catch (error: unknown) {
    if (error instanceof ImageAssetConfigurationError) throw error;
    throw new ImageAssetConfigurationError();
  }
}