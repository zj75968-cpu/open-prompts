const ASSET_OWNER_COOKIE_NAME = 'op_asset_owner_v1';
const ASSET_OWNER_COOKIE_VERSION = 'v1';
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export type AssetOwnerIdentity = {
  ownerId: string | null;
  authorizedOwnerIds: string[];
  setCookie?: string;
};

export class AssetOwnerConfigurationError extends Error {
  constructor(message = 'Asset owner cookie signing secret is not configured.') {
    super(message);
    this.name = 'AssetOwnerConfigurationError';
  }
}

function cookieValue(cookieHeader: string, name: string): string | null {
  const prefix = `${name}=`;
  const value = String(cookieHeader || '')
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(prefix))
    ?.slice(prefix.length);
  if (!value) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
}

function signingSecret(): string {
  const secret = String(
    process.env.ASSET_OWNER_COOKIE_SECRET ||
      process.env.NEXTAUTH_SECRET ||
      process.env.CREDITS_COOKIE_SECRET ||
      '',
  ).trim();
  if (!secret || (process.env.NODE_ENV === 'production' && secret.length < 24)) {
    throw new AssetOwnerConfigurationError();
  }
  return secret;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    const chunk = bytes.subarray(offset, offset + chunkSize);
    for (let index = 0; index < chunk.length; index += 1) {
      binary += String.fromCharCode(chunk[index]);
    }
  }
  return globalThis.btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function signature(payload: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await globalThis.crypto.subtle.importKey(
    'raw',
    encoder.encode(signingSecret()),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const value = await globalThis.crypto.subtle.sign('HMAC', key, encoder.encode(payload));
  return bytesToBase64Url(new Uint8Array(value));
}

function constantTimeEqual(left: string, right: string): boolean {
  const maxLength = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < maxLength; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function normalizeAuthenticatedUserId(userId: string): string {
  const normalized = String(userId || '').trim().toLowerCase();
  if (!UUID_PATTERN.test(normalized)) {
    throw new Error('Authenticated user id is invalid.');
  }
  return normalized;
}

export function assetOwnerIdForUser(userId: string): string {
  return `user:${normalizeAuthenticatedUserId(userId)}`;
}

function anonymousOwnerId(id: string): string {
  return `anon:${id.toLowerCase()}`;
}

async function readAnonymousOwner(cookieHeader: string): Promise<string | null> {
  const value = cookieValue(cookieHeader, ASSET_OWNER_COOKIE_NAME);
  if (!value) return null;
  const [version, id, receivedSignature, ...extra] = value.split('.');
  if (
    extra.length > 0 ||
    version !== ASSET_OWNER_COOKIE_VERSION ||
    !UUID_PATTERN.test(id || '') ||
    !receivedSignature
  ) {
    return null;
  }
  const expectedSignature = await signature(`${version}.${id.toLowerCase()}`);
  return constantTimeEqual(receivedSignature, expectedSignature)
    ? anonymousOwnerId(id)
    : null;
}

async function createAnonymousOwner(): Promise<{ ownerId: string; setCookie: string }> {
  const id = globalThis.crypto?.randomUUID?.();
  if (!id) throw new Error('Secure random UUID generation is unavailable.');
  const payload = `${ASSET_OWNER_COOKIE_VERSION}.${id}`;
  const value = `${payload}.${await signature(payload)}`;
  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  return {
    ownerId: anonymousOwnerId(id),
    setCookie: `${ASSET_OWNER_COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax${secure}`,
  };
}

export async function resolveAssetOwner(args: {
  cookieHeader: string;
  userId?: string | null;
  issueAnonymous: boolean;
}): Promise<AssetOwnerIdentity> {
  let anonymousOwner: string | null = null;
  try {
    anonymousOwner = await readAnonymousOwner(args.cookieHeader);
  } catch (error: unknown) {
    if (args.issueAnonymous || !(error instanceof AssetOwnerConfigurationError)) throw error;
  }
  if (args.userId) {
    const ownerId = assetOwnerIdForUser(args.userId);
    const legacyOwnerId = ownerId.slice('user:'.length);
    return {
      ownerId,
      authorizedOwnerIds: anonymousOwner
        ? [ownerId, legacyOwnerId, anonymousOwner]
        : [ownerId, legacyOwnerId],
    };
  }
  if (anonymousOwner) {
    return { ownerId: anonymousOwner, authorizedOwnerIds: [anonymousOwner] };
  }
  if (!args.issueAnonymous) {
    return { ownerId: null, authorizedOwnerIds: [] };
  }
  const created = await createAnonymousOwner();
  return {
    ownerId: created.ownerId,
    authorizedOwnerIds: [created.ownerId],
    setCookie: created.setCookie,
  };
}

export function assetOwnerStoragePath(ownerId: string): string {
  if (ownerId.startsWith('user:')) return `users/${ownerId.slice(5)}`;
  if (ownerId.startsWith('anon:')) return `anonymous/${ownerId.slice(5)}`;
  throw new Error('Image asset owner id is invalid.');
}