export type GenerationStatus = 'queued' | 'running' | 'succeeded' | 'failed';

export type GenerationImageInput =
  | string
  | {
      url?: string;
      dataUrl?: string;
      base64?: string;
      mimeType?: string;
    };

export type GenerationCreateParams = {
  prompt: string;
  negativePrompt?: string;
  model?: string;
  aspectRatio?: string;
  quality?: string;
  count?: number;
  /** Public URL, data URL, or a serializable image input object. */
  referenceImages?: GenerationImageInput[];
  /** Alias used by providers that call reference images input images. */
  imageInputs?: GenerationImageInput[];
};

export type GenerationCreateResult = {
  providerJobId: string;
  status: GenerationStatus;
  images?: string[];
};

export type GenerationPollResult = {
  providerJobId: string;
  status: GenerationStatus;
  images?: string[];
  error?: string;
};

export type ImageGenerationProvider = {
  provider: string;
  create(params: GenerationCreateParams): Promise<GenerationCreateResult>;
  poll(providerJobId: string): Promise<GenerationPollResult>;
};

