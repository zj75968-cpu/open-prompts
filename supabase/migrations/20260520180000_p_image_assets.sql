-- R2-backed image metadata. Image bytes live only in Cloudflare R2.

create table if not exists public.p_image_assets (
  id uuid primary key default gen_random_uuid(),
  object_key text not null,
  owner_id text not null,
  mime_type text not null,
  byte_size bigint not null,
  width integer,
  height integer,
  source text not null,
  visibility text not null default 'private',
  status text not null default 'pending',
  provider text,
  provider_job_id text,
  image_index integer,
  persistence_claim_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint p_image_assets_source_chk check (source in ('upload', 'generated', 'imported')),
  constraint p_image_assets_visibility_chk check (visibility in ('private', 'public')),
  constraint p_image_assets_status_chk check (status in ('pending', 'persisting', 'ready', 'deleting', 'failed')),
  constraint p_image_assets_persistence_claim_chk check (
    (status = 'persisting' and persistence_claim_id is not null)
    or (status <> 'persisting' and persistence_claim_id is null)
  ),
  constraint p_image_assets_byte_size_chk check (byte_size > 0 and byte_size <= 10485760),
  constraint p_image_assets_dimensions_chk check (
    (width is null or width > 0) and (height is null or height > 0)
  ),
  constraint p_image_assets_owner_chk check (
    owner_id ~ '^(user|anon):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ),
  constraint p_image_assets_mime_type_chk check (
    mime_type in ('image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/avif')
  ),
  constraint p_image_assets_generated_fields_chk check (
    (
      source = 'generated'
      and nullif(btrim(provider), '') is not null
      and nullif(btrim(provider_job_id), '') is not null
      and image_index is not null
      and image_index >= 0
    ) or (
      source <> 'generated'
      and provider is null
      and provider_job_id is null
      and image_index is null
    )
  )
);

create unique index if not exists p_image_assets_object_key_key
  on public.p_image_assets (object_key);

create index if not exists p_image_assets_owner_id_idx
  on public.p_image_assets (owner_id);

create index if not exists p_image_assets_visibility_status_idx
  on public.p_image_assets (visibility, status);

create index if not exists p_image_assets_updated_at_idx
  on public.p_image_assets (updated_at);

create unique index if not exists p_image_assets_generated_image_key
  on public.p_image_assets (provider, provider_job_id, image_index);

comment on table public.p_image_assets is 'Metadata for image objects stored in private Cloudflare R2.';
comment on column public.p_image_assets.object_key is 'Private R2 object key; never expose directly to clients.';
comment on column public.p_image_assets.owner_id is 'Namespaced API owner: user:{id} or anon:{signed-cookie-uuid}.';

alter table public.p_image_assets enable row level security;

create table if not exists public.p_generation_jobs (
  id uuid primary key default gen_random_uuid(),
  provider text not null,
  provider_job_id text not null,
  owner_id text not null,
  requested_count integer not null default 1,
  status text not null default 'queued',
  result_asset_ids uuid[] not null default '{}'::uuid[],
  error text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint p_generation_jobs_provider_job_chk check (
    nullif(btrim(provider), '') is not null
    and nullif(btrim(provider_job_id), '') is not null
  ),
  constraint p_generation_jobs_requested_count_chk check (
    requested_count > 0 and requested_count <= 10
  ),
  constraint p_generation_jobs_owner_chk check (
    owner_id ~ '^(user|anon):[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  ),
  constraint p_generation_jobs_status_chk check (
    status in ('queued', 'running', 'succeeded', 'failed')
  ),
  constraint p_generation_jobs_completion_chk check (
    (
      status = 'succeeded'
      and cardinality(result_asset_ids) between 1 and requested_count
      and completed_at is not null
      and error is null
    ) or (
      status = 'failed'
      and cardinality(result_asset_ids) = 0
      and completed_at is not null
    ) or (
      status in ('queued', 'running')
      and cardinality(result_asset_ids) = 0
      and completed_at is null
      and error is null
    )
  )
);

create unique index if not exists p_generation_jobs_provider_job_key
  on public.p_generation_jobs (provider, provider_job_id);

create index if not exists p_generation_jobs_owner_id_idx
  on public.p_generation_jobs (owner_id);

create index if not exists p_generation_jobs_status_updated_idx
  on public.p_generation_jobs (status, updated_at);

comment on table public.p_generation_jobs is 'Generation ownership and persisted R2 result references for authenticated polling and idempotency.';

alter table public.p_generation_jobs enable row level security;

-- The server connects through DATABASE_URL and performs all authorization.
-- Browser-side Supabase roles must never read or mutate asset metadata directly.
revoke all on table public.p_image_assets from public, anon, authenticated;
revoke all on table public.p_generation_jobs from public, anon, authenticated;
grant all on table public.p_image_assets to service_role;
grant all on table public.p_generation_jobs to service_role;

drop policy if exists "p_image_assets_deny_direct_access" on public.p_image_assets;
create policy "p_image_assets_deny_direct_access"
  on public.p_image_assets
  for all
  to anon, authenticated
  using (false)
  with check (false);

drop policy if exists "p_generation_jobs_deny_direct_access" on public.p_generation_jobs;
create policy "p_generation_jobs_deny_direct_access"
  on public.p_generation_jobs
  for all
  to anon, authenticated
  using (false)
  with check (false);