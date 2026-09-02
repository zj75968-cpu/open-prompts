import { PROMPT_GALLERY } from '~/data/promptGallery';
import type { PromptGalleryItem } from '~/lib/prompts/prompt-model';
import { fetchPromptGalleryFromDb } from '~/lib/prompts/from-db';

const PROMPT_GALLERY_DB_TIMEOUT_MS = 1500;

/**
 * Loads the prompt catalog: Postgres (Drizzle + DATABASE_URL) when non-empty, else bundled JSON.
 * A stale or unreachable database must not block the create workbench.
 */
export async function getPromptGallery(): Promise<PromptGalleryItem[]> {
  try {
    const fromDb = await withTimeout(
      fetchPromptGalleryFromDb(),
      PROMPT_GALLERY_DB_TIMEOUT_MS,
    );
    if (fromDb && fromDb.length > 0) return fromDb;
  } catch {
    // A malformed or unavailable database must not block the create workbench.
  }
  return PROMPT_GALLERY;
}

/** Sitemap / build: never fail — fall back to bundled JSON if DB is slow or empty. */
export async function getPromptGalleryForSitemap(): Promise<PromptGalleryItem[]> {
  try {
    const fromDb = await fetchPromptGalleryFromDb();
    if (fromDb && fromDb.length > 0) return fromDb;
  } catch {
    // Workers runtime or pool timeout — bundled slugs still give crawlable URLs.
  }
  return PROMPT_GALLERY;
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => {
    timeoutId = setTimeout(() => resolve(null), timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}
