import { and, eq, inArray } from 'drizzle-orm';
import type { Db } from '~/db/client';
import { generationJobs } from '~/db/schema';
import type { GenerationStatus } from '~/lib/generation/types';

export type GenerationJobRecord = typeof generationJobs.$inferSelect;

function databaseErrorCode(error: unknown): string {
  return typeof error === 'object' && error !== null && 'code' in error
    ? String((error as { code: unknown }).code)
    : '';
}

export async function getGenerationJobRecord(
  db: Db,
  provider: string,
  providerJobId: string,
): Promise<GenerationJobRecord | null> {
  const [row] = await db
    .select()
    .from(generationJobs)
    .where(
      and(
        eq(generationJobs.provider, provider),
        eq(generationJobs.providerJobId, providerJobId),
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function recordGenerationJob(args: {
  db: Db;
  provider: string;
  providerJobId: string;
  ownerId: string;
  requestedCount: number;
  status?: GenerationStatus;
}): Promise<GenerationJobRecord> {
  try {
    const [row] = await args.db
      .insert(generationJobs)
      .values({
        provider: args.provider,
        providerJobId: args.providerJobId,
        ownerId: args.ownerId,
        requestedCount: Math.min(10, Math.max(1, Math.floor(args.requestedCount))),
        status: args.status ?? 'queued',
        completedAt: args.status === 'failed' ? new Date() : null,
      })
      .returning();
    if (!row) throw new Error('Generation job insert returned no row.');
    return row;
  } catch (error: unknown) {
    if (databaseErrorCode(error) !== '23505') throw error;
    const existing = await getGenerationJobRecord(
      args.db,
      args.provider,
      args.providerJobId,
    );
    if (!existing) throw error;
    if (existing.ownerId !== args.ownerId) {
      throw new Error('Generation job ownership conflict.');
    }
    return existing;
  }
}

export async function updateGenerationJob(args: {
  db: Db;
  provider: string;
  providerJobId: string;
  ownerId: string;
  status: GenerationStatus;
  resultAssetIds?: string[];
  error?: string | null;
}): Promise<boolean> {
  if (args.status === 'succeeded' && !args.resultAssetIds?.length) {
    throw new Error('Succeeded generation jobs require persisted result assets.');
  }
  const completed = args.status === 'succeeded' || args.status === 'failed';
  const mutableStatuses =
    args.status === 'succeeded'
      ? ['queued', 'running', 'succeeded', 'failed'] as const
      : args.status === 'failed'
        ? ['queued', 'running', 'failed'] as const
        : ['queued', 'running'] as const;
  const updated = await args.db
    .update(generationJobs)
    .set({
      status: args.status,
      resultAssetIds:
        args.status === 'succeeded' ? args.resultAssetIds! : [],
      error:
        args.status === 'failed'
          ? args.error?.trim().slice(0, 2_000) || null
          : null,
      completedAt: completed ? new Date() : null,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(generationJobs.provider, args.provider),
        eq(generationJobs.providerJobId, args.providerJobId),
        eq(generationJobs.ownerId, args.ownerId),
        inArray(generationJobs.status, mutableStatuses),
      ),
    )
    .returning({ id: generationJobs.id });
  return updated.length === 1;
}