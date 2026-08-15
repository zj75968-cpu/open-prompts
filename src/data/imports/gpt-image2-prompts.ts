import imported from './gpt-image2-prompts.json';
import {
  normalizeImportedPromptAssets,
  type ImportedPromptRecord,
  type PromptAsset,
} from '../../lib/prompts/prompt-asset';

export const GPT_IMAGE_2_PROMPT_ASSETS: PromptAsset[] = normalizeImportedPromptAssets(
  imported as readonly ImportedPromptRecord[],
  { provider: 'openai', model: 'GPT Image 2' },
);