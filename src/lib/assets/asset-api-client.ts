import type { ImageAssetDto } from '~/lib/assets/asset-types';

export type ImageAssetApiResponse =
  | { asset: ImageAssetDto }
  | { error: string };

export async function uploadImageAsset(file: File): Promise<ImageAssetDto> {
  const form = new FormData();
  form.set('file', file);
  const response = await fetch('/api/assets', {
    method: 'POST',
    body: form,
  });
  const data = (await response.json().catch(() => ({}))) as ImageAssetApiResponse;
  if (!response.ok || !('asset' in data)) {
    throw new Error('error' in data && data.error ? data.error : `Image upload failed (${response.status}).`);
  }
  return data.asset;
}