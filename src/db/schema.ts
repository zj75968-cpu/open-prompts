import { sql } from 'drizzle-orm';
import {
  bigint,
  check,
  index,
  integer,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';

/** `p_prompts` — see supabase/migrations for full history (create + review status). */
export const promptReviewStatuses = ['pending', 'approved', 'rejected'] as const;
export type PromptReviewStatus = (typeof promptReviewStatuses)[number];

export const promptVisibilities = ['draft', 'private', 'public'] as const;
export type PromptVisibility = (typeof promptVisibilities)[number];

export const prompts = pgTable('p_prompts', {
  id: bigint('id', { mode: 'number' }).primaryKey().generatedAlwaysAsIdentity(),
  slug: text('slug').notNull().unique(),
  title: text('title').notNull(),
  description: text('description').notNull().default(''),
  prompt: text('prompt').notNull().default(''),
  templateId: text('template_id'),
  model: text('model').notNull().default('GPT Image 2'),
  /** Submit primary category key — see `SUBMIT_CATEGORY_KEYS`. */
  category: text('category'),
  tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
  sourceUrl: text('source_url'),
  authorHandle: text('author_handle'),
  images: text('images').array().notNull().default(sql`'{}'::text[]`),
  /** Gallery shows `approved` only; new user submissions typically start as `pending`. */
  status: text('status').notNull().default('approved'),
  /** Owner user id; no DB FK — enforced in API (avoids DDL lock / pooler issues). */
  submittedBy: uuid('submitted_by'),
  visibility: text('visibility').notNull().default('public'),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
});

export const imageAssetSources = ['upload', 'generated', 'imported'] as const;
export type ImageAssetSource = (typeof imageAssetSources)[number];

export const imageAssetVisibilities = ['private', 'public'] as const;
export type ImageAssetVisibility = (typeof imageAssetVisibilities)[number];

export const imageAssetStatuses = ['pending', 'persisting', 'ready', 'deleting', 'failed'] as const;
export type ImageAssetStatus = (typeof imageAssetStatuses)[number];

export const imageAssets = pgTable(
  'p_image_assets',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    objectKey: text('object_key').notNull(),
    /** Namespaced owner (`user:{id}` or signed-cookie `anon:{uuid}`); authorization is API-only. */
    ownerId: text('owner_id').notNull(),
    mimeType: text('mime_type').notNull(),
    byteSize: bigint('byte_size', { mode: 'number' }).notNull(),
    width: integer('width'),
    height: integer('height'),
    source: text('source').$type<ImageAssetSource>().notNull(),
    visibility: text('visibility').$type<ImageAssetVisibility>().notNull().default('private'),
    status: text('status').$type<ImageAssetStatus>().notNull().default('pending'),
    provider: text('provider'),
    providerJobId: text('provider_job_id'),
    imageIndex: integer('image_index'),
    persistenceClaimId: uuid('persistence_claim_id'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    objectKeyKey: uniqueIndex('p_image_assets_object_key_key').on(t.objectKey),
    ownerIdIdx: index('p_image_assets_owner_id_idx').on(t.ownerId),
    visibilityStatusIdx: index('p_image_assets_visibility_status_idx').on(
      t.visibility,
      t.status,
    ),
    updatedAtIdx: index('p_image_assets_updated_at_idx').on(t.updatedAt),
    generatedImageKey: uniqueIndex('p_image_assets_generated_image_key').on(
      t.provider,
      t.providerJobId,
      t.imageIndex,
    ),
    sourceCheck: check(
      'p_image_assets_source_chk',
      sql`${t.source} in ('upload', 'generated', 'imported')`,
    ),
    visibilityCheck: check(
      'p_image_assets_visibility_chk',
      sql`${t.visibility} in ('private', 'public')`,
    ),
    statusCheck: check(
      'p_image_assets_status_chk',
      sql`${t.status} in ('pending', 'persisting', 'ready', 'deleting', 'failed')`,
    ),
    persistenceClaimCheck: check(
      'p_image_assets_persistence_claim_chk',
      sql`(${t.status} = 'persisting' and ${t.persistenceClaimId} is not null) or (${t.status} <> 'persisting' and ${t.persistenceClaimId} is null)`,
    ),
    byteSizeCheck: check(
      'p_image_assets_byte_size_chk',
      sql`${t.byteSize} > 0 and ${t.byteSize} <= 10485760`,
    ),
    dimensionsCheck: check(
      'p_image_assets_dimensions_chk',
      sql`(${t.width} is null or ${t.width} > 0) and (${t.height} is null or ${t.height} > 0)`,
    ),
    ownerCheck: check(
      'p_image_assets_owner_chk',
      sql`${t.ownerId} ~ '^(user|anon):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'`,
    ),
    mimeTypeCheck: check(
      'p_image_assets_mime_type_chk',
      sql`${t.mimeType} in ('image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif')`,
    ),
    generatedFieldsCheck: check(
      'p_image_assets_generated_fields_chk',
      sql`(
        ${t.source} = 'generated'
        and nullif(btrim(${t.provider}), '') is not null
        and nullif(btrim(${t.providerJobId}), '') is not null
        and ${t.imageIndex} is not null
        and ${t.imageIndex} >= 0
      ) or (
        ${t.source} <> 'generated'
        and ${t.provider} is null
        and ${t.providerJobId} is null
        and ${t.imageIndex} is null
      )`,
    ),
  }),
);

export const generationJobStatuses = ['queued', 'running', 'succeeded', 'failed'] as const;
export type GenerationJobStatus = (typeof generationJobStatuses)[number];

export const generationJobs = pgTable(
  'p_generation_jobs',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    provider: text('provider').notNull(),
    providerJobId: text('provider_job_id').notNull(),
    ownerId: text('owner_id').notNull(),
    requestedCount: integer('requested_count').notNull().default(1),
    status: text('status').$type<GenerationJobStatus>().notNull().default('queued'),
    resultAssetIds: uuid('result_asset_ids').array().notNull().default(sql`'{}'::uuid[]`),
    error: text('error'),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    providerJobKey: uniqueIndex('p_generation_jobs_provider_job_key').on(
      t.provider,
      t.providerJobId,
    ),
    ownerIdIdx: index('p_generation_jobs_owner_id_idx').on(t.ownerId),
    statusUpdatedIdx: index('p_generation_jobs_status_updated_idx').on(t.status, t.updatedAt),
    providerJobCheck: check(
      'p_generation_jobs_provider_job_chk',
      sql`nullif(btrim(${t.provider}), '') is not null and nullif(btrim(${t.providerJobId}), '') is not null`,
    ),
    requestedCountCheck: check(
      'p_generation_jobs_requested_count_chk',
      sql`${t.requestedCount} > 0 and ${t.requestedCount} <= 10`,
    ),
    ownerCheck: check(
      'p_generation_jobs_owner_chk',
      sql`${t.ownerId} ~ '^(user|anon):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'`,
    ),
    statusCheck: check(
      'p_generation_jobs_status_chk',
      sql`${t.status} in ('queued', 'running', 'succeeded', 'failed')`,
    ),
    completionCheck: check(
      'p_generation_jobs_completion_chk',
      sql`(
        ${t.status} = 'succeeded'
        and cardinality(${t.resultAssetIds}) between 1 and ${t.requestedCount}
        and ${t.completedAt} is not null
        and ${t.error} is null
      ) or (
        ${t.status} = 'failed'
        and cardinality(${t.resultAssetIds}) = 0
        and ${t.completedAt} is not null
      ) or (
        ${t.status} in ('queued', 'running')
        and cardinality(${t.resultAssetIds}) = 0
        and ${t.completedAt} is null
        and ${t.error} is null
      )`,
    ),
  }),
);

export const users = pgTable('p_users', {
  id: uuid('id').primaryKey().defaultRandom(),
  name: text('name'),
  email: text('email').notNull().unique(),
  emailVerified: timestamp('email_verified', { withTimezone: true }),
  image: text('image'),
  passwordHash: text('password_hash'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  /** Last authenticated activity; used for admin DAU (UTC calendar day). */
  lastActiveAt: timestamp('last_active_at', { withTimezone: true }),
});

export const accounts = pgTable(
  'p_accounts',
  {
    id: uuid('id').primaryKey().defaultRandom(),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull().default('oauth'),
    provider: text('provider').notNull(),
    providerAccountId: text('provider_account_id').notNull(),
    refreshToken: text('refresh_token'),
    accessToken: text('access_token'),
    expiresAt: bigint('expires_at', { mode: 'number' }),
    tokenType: text('token_type'),
    scope: text('scope'),
    idToken: text('id_token'),
    sessionState: text('session_state'),
  },
  (t) => ({
    providerAccountKey: uniqueIndex('p_accounts_provider_provider_account_id_key').on(
      t.provider,
      t.providerAccountId
    ),
  })
);

export const verificationTokens = pgTable(
  'p_verification_tokens',
  {
    identifier: text('identifier').notNull(),
    token: text('token').notNull(),
    expires: timestamp('expires', { withTimezone: true }).notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.identifier, t.token] }),
  })
);
