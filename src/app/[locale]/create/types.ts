export type GenerationUiState = 'idle' | 'queued' | 'running' | 'succeeded' | 'failed';

export type SwipeViewerState = {
  images: string[];
  initialIndex: number;
  title: string;
  imageKeyPrefix: string;
  showDownload: boolean;
};

export type CreateHeroBlock = {
  /** Full headline for reference / accessibility */
  title: string;
  titleLine1: string;
  titleLine2Before: string;
  titleLine2Em: string;
  titleLine2After: string;
  subtitle: string;
  featuresTitle: string;
  features: { t: string; d: string }[];
  howTitle: string;
  howSteps: string[];
  whyTitle: string;
  whyPoints: string[];
  sayTitle: string;
  says: { q: string; a: string }[];
  faqTitle: string;
  faqs: { q: string; a: string }[];
  ctaTitle: string;
  ctaSubtitle: string;
  ctaButton: string;
};

export type InternalConfigCopy = { title: string; body: string; steps: string[] };

export type GenerationHistoryEntry = {
  id: string;
  createdAt: number;
  providerJobId: string | null;
  prompt: string;
  model: string;
  provider: string;
  aspectRatio: string;
  quality: string;
  count: number;
  images: string[];
};