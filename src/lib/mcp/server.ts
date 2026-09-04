import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import { getPromptBySlug } from '~/lib/prompts/get-prompt-by-slug';
import { getPromptGallery } from '~/lib/prompts/get-prompt-gallery';
import type { PromptGalleryItem } from '~/lib/prompts/prompt-model';
import { createGeneration } from '~/lib/generation/generation-create-service';
import { pollGeneration } from '~/lib/generation/generation-poll-service';
import type { AssetOwnerIdentity } from '~/lib/assets/asset-owner';

const MAX_SEARCH_RESULTS = 100;

function textResult(value: unknown) {
  return {
    content: [{ type: 'text' as const, text: JSON.stringify(value, null, 2) }],
  };
}

function errorResult(message: string) {
  return {
    isError: true,
    content: [{ type: 'text' as const, text: message }],
  };
}

function normalized(value: string | undefined): string {
  return String(value || '').trim().toLowerCase();
}

function matchesQuery(prompt: PromptGalleryItem, query: string): boolean {
  if (!query) return true;
  const haystack = [
    prompt.title,
    prompt.description,
    prompt.prompt,
    prompt.model,
    prompt.category || '',
    ...(prompt.tags || []),
  ]
    .join(' ')
    .toLowerCase();
  return haystack.includes(query);
}

function getMcpAssetOwner(): AssetOwnerIdentity {
  const ownerId = String(process.env.MCP_ASSET_OWNER_ID || '').trim();
  if (!/^(anon|user):[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(ownerId)) {
    throw new Error(
      'MCP_ASSET_OWNER_ID must be a stable owner id in the form anon:<uuid> or user:<uuid>.',
    );
  }
  return { ownerId, authorizedOwnerIds: [ownerId] };
}

export function createOpenPromptsMcpServer(): McpServer {
  const server = new McpServer({
    name: 'open-prompts',
    version: '0.1.0',
  });

  server.registerTool(
    'search_prompts',
    {
      title: 'Search prompts',
      description: 'Search the public Open Prompts gallery by text, model, or category.',
      inputSchema: {
        query: z.string().optional().describe('Text to search in title, description, prompt, tags, and model.'),
        model: z.string().optional().describe('Exact model filter.'),
        category: z.string().optional().describe('Exact category filter.'),
        limit: z.number().int().min(1).max(MAX_SEARCH_RESULTS).optional().describe('Maximum results, default 20.'),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ query, model, category, limit }) => {
      try {
        let prompts = await getPromptGallery();
        const normalizedModel = normalized(model);
        const normalizedCategory = normalized(category);
        const normalizedQuery = normalized(query);
        if (normalizedModel) {
          prompts = prompts.filter((prompt) => normalized(prompt.model) === normalizedModel);
        }
        if (normalizedCategory) {
          prompts = prompts.filter((prompt) => normalized(prompt.category || undefined) === normalizedCategory);
        }
        const matches = prompts.filter((prompt) => matchesQuery(prompt, normalizedQuery));
        const results = matches.slice(0, limit || 20);
        return textResult({
          total: matches.length,
          returned: results.length,
          prompts: results,
        });
      } catch (error: unknown) {
        return errorResult(error instanceof Error ? error.message : 'Failed to search prompts.');
      }
    },
  );

  server.registerTool(
    'get_prompt',
    {
      title: 'Get prompt details',
      description: 'Get one public prompt from the gallery by its slug or id.',
      inputSchema: {
        slug: z.string().min(1).describe('Prompt slug or id.'),
      },
      annotations: { readOnlyHint: true, openWorldHint: false },
    },
    async ({ slug }) => {
      try {
        const prompt = await getPromptBySlug(slug.trim());
        if (!prompt) return errorResult(`Prompt not found: ${slug}`);
        return textResult(prompt);
      } catch (error: unknown) {
        return errorResult(error instanceof Error ? error.message : 'Failed to load prompt.');
      }
    },
  );

  server.registerTool(
    'create_generation',
    {
      title: 'Create image generation',
      description: 'Create an image generation job using the server-configured image provider.',
      inputSchema: {
        prompt: z.string().min(1).describe('Image generation prompt.'),
        negativePrompt: z.string().optional(),
        provider: z.string().optional().describe('Provider name configured by the server.'),
        model: z.string().optional(),
        aspectRatio: z.string().optional(),
        quality: z.string().optional(),
        inputFidelity: z.enum(['high', 'low']).optional(),
        count: z.number().int().min(1).max(10).optional(),
        referenceImages: z.array(z.string().min(1)).max(4).optional().describe('Public URLs or data URLs.'),
      },
      annotations: { readOnlyHint: false, destructiveHint: false, openWorldHint: true },
    },
    async (args) => {
      try {
        const assetOwner = getMcpAssetOwner();
        const result = await createGeneration(
          {
            ...args,
            imageInputs: undefined,
          },
          { cookieHeader: '', assetOwner },
        );
        return textResult({ status: result.status, ...result.body });
      } catch (error: unknown) {
        return errorResult(error instanceof Error ? error.message : 'Failed to create generation.');
      }
    },
  );

  server.registerTool(
    'poll_generation',
    {
      title: 'Poll image generation',
      description: 'Check the status of a generation job created through Open Prompts.',
      inputSchema: {
        providerJobId: z.string().min(1).describe('Encoded provider job id returned by create_generation.'),
      },
      annotations: { readOnlyHint: false, openWorldHint: true },
    },
    async ({ providerJobId }) => {
      try {
        const assetOwner = getMcpAssetOwner();
        const result = await pollGeneration({
          encodedProviderJobId: providerJobId.trim(),
          apiKey: '',
          assetOwner,
        });
        return textResult({ status: result.status, ...result.body });
      } catch (error: unknown) {
        return errorResult(error instanceof Error ? error.message : 'Failed to poll generation.');
      }
    },
  );

  return server;
}