import { NextResponse } from 'next/server';
import { getDb } from '~/db/client';
import { getAuthSession } from '~/lib/auth/session';
import { ImageAssetConfigurationError } from '~/lib/assets/cloudflare-r2';
import {
  AssetOwnerConfigurationError,
  resolveAssetOwner,
} from '~/lib/assets/asset-owner';
import { MAX_IMAGE_BYTES } from '~/lib/assets/image-input';
import { createUploadedImageAsset } from '~/lib/assets/asset-service';

export const dynamic = 'force-dynamic';

function errorStatus(error: unknown): number {
  if (error instanceof ImageAssetConfigurationError || error instanceof AssetOwnerConfigurationError) return 503;
  const message = error instanceof Error ? error.message : '';
  if (/database|configured/i.test(message)) return 503;
  if (/exceeds|size limit/i.test(message)) return 413;
  if (/image|file|mime|empty|size|unsupported|invalid/i.test(message)) return 400;
  return 500;
}

export async function POST(req: Request) {
  const session = await getAuthSession();

  const db = getDb();
  if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  try {
    const declaredLength = Number(req.headers.get('content-length') || 0);
    if (declaredLength > MAX_IMAGE_BYTES + 1024 * 1024) {
      return NextResponse.json({ error: 'Image upload is too large.' }, { status: 413 });
    }
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ error: 'Missing image file.' }, { status: 400 });
    }
    const owner = await resolveAssetOwner({
      cookieHeader: req.headers.get('cookie') || '',
      userId: session?.user?.id ?? null,
      issueAnonymous: true,
    });
    if (!owner.ownerId) {
      return NextResponse.json({ error: 'Unable to resolve image owner.' }, { status: 401 });
    }
    const asset = await createUploadedImageAsset({
      db,
      ownerId: owner.ownerId,
      file,
    });
    const response = NextResponse.json({ asset }, { status: 201 });
    if (owner.setCookie) response.headers.append('set-cookie', owner.setCookie);
    return response;
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Image upload failed.';
    console.error('[assets POST]', { error: message });
    return NextResponse.json({ error: message }, { status: errorStatus(error) });
  }
}