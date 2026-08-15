/**
 * Upsert bundled prompts via Drizzle (needs DATABASE_URL in env or .env.local).
 * Usage: npm run seed:prompts
 */
import { config } from 'dotenv';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from '../src/db/schema';
import { GPT_IMAGE_2_PROMPT_ASSETS } from '../src/data/imports/gpt-image2-prompts';
import { promptAssetToSeedRow } from '../src/lib/prompts/prompt-asset';

config({ path: '.env.local' });
config({ path: '.env' });

function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}

const rows = GPT_IMAGE_2_PROMPT_ASSETS.map(promptAssetToSeedRow);

async function main() {
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) fail('Set DATABASE_URL (e.g. in .env.local)');

  const client = postgres(databaseUrl, { max: 1, prepare: false });
  const db = drizzle(client, { schema });
  const { prompts } = schema;

  const chunkSize = 50;
  try {
    for (let i = 0; i < rows.length; i += chunkSize) {
      const chunk = rows.slice(i, i + chunkSize);
      await db
        .insert(prompts)
        .values(chunk)
        .onConflictDoUpdate({
          target: prompts.slug,
          set: {
            title: sql`excluded.title`,
            description: sql`excluded.description`,
            prompt: sql`excluded.prompt`,
            templateId: sql`excluded.template_id`,
            model: sql`excluded.model`,
            tags: sql`excluded.tags`,
            sourceUrl: sql`excluded.source_url`,
            authorHandle: sql`excluded.author_handle`,
            images: sql`excluded.images`,
            sortOrder: sql`excluded.sort_order`,
            updatedAt: sql`now()`,
          },
        });
      console.info(`Upserted ${Math.min(i + chunk.length, rows.length)}/${rows.length}`);
    }
    console.info('Done.');
  } finally {
    await client.end({ timeout: 5 });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});