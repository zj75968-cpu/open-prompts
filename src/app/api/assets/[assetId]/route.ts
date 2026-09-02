import { NextResponse } from 'next/server';
import { getDb } from '~/db/client';
import { isAdminEmail } from '~/lib/auth/admin-emails';
import { getAuthSession } from '~/lib/auth/session';
import { ImageAssetConfigurationError } from '~/lib/assets/cloudflare-r2';
import {
  AssetOwnerConfigurationError,
  resolveAssetOwner,
} from '~/lib/assets/asset-owner';
import {
  deleteOwnedImageAsset,
  getReadableImageAsset,
} from '~/lib/assets/asset-service';
import { isImageAssetId } from '~/lib/assets/asset-types';

export const dynamic = 'force-dynamic';

type AssetRouteContext = { params: Promise<{ assetId: string }> };

export async function GET(req: Request, { params }: AssetRouteContext) {
  const { assetId } = await params;
  if (!isImageAssetId(assetId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const db = getDb();
  if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  try {
    const session = await getAuthSession();
    const owner = await resolveAssetOwner({
      cookieHeader: req.headers.get('cookie') || '',
      userId: session?.user?.id ?? null,
      issueAnonymous: false,
    });
    const asset = await getReadableImageAsset({
      db,
      assetId,
      requesterOwnerIds: owner.authorizedOwnerIds,
      allowPrivate: isAdminEmail(session?.user?.email),
    });
    if (!asset) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const cacheControl =
      asset.row.visibility === 'public'
        ? 'public, no-cache, must-revalidate'
        : 'private, no-store';
    if (req.headers.get('if-none-match') === asset.etag) {
      return new Response(null, {
        status: 304,
        headers: { etag: asset.etag, 'cache-control': cacheControl },
      });
    }

    return new Response(asset.body, {
      status: 200,
      headers: {
        'content-type': asset.row.mimeType,
        'content-length': String(asset.row.byteSize),
        'cache-control': cacheControl,
        etag: asset.etag,
        'x-content-type-options': 'nosniff',
        'content-disposition': `inline; filename="${asset.row.id}"`,
      },
    });
  } catch (error: unknown) {
    const status =
      error instanceof ImageAssetConfigurationError || error instanceof AssetOwnerConfigurationError
        ? 503
        : 500;
    const message = error instanceof Error ? error.message : 'Image read failed.';
    console.error('[assets GET]', { assetId, error: message });
    return NextResponse.json({ error: message }, { status });
  }
}

export async function DELETE(req: Request, { params }: AssetRouteContext) {
  const session = await getAuthSession();

  const { assetId } = await params;
  if (!isImageAssetId(assetId)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const db = getDb();
  if (!db) return NextResponse.json({ error: 'Database not configured' }, { status: 503 });

  try {
    const owner = await resolveAssetOwner({
      cookieHeader: req.headers.get('cookie') || '',
      userId: session?.user?.id ?? null,
      issueAnonymous: false,
    });
    const deleted = await deleteOwnedImageAsset({
      db,
      assetId,
      authorizedOwnerIds: owner.authorizedOwnerIds,
    });
    if (!deleted) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Image delete failed.';
    const status =
      error instanceof ImageAssetConfigurationError || error instanceof AssetOwnerConfigurationError
        ? 503
        : /referenced|changed while being deleted/i.test(message)
          ? 409
          : 500;
    console.error('[assets DELETE]', { assetId, error: message });
    return NextResponse.json({ error: message }, { status });
  }
}