'use client';

import { useEffect, useState } from 'react';

const DRAFT_PARAM = 'promptlensDraft';
const EXTENSION_SOURCE = 'promptlens-extension';
const PAGE_SOURCE = 'open-prompts';
const DRAFT_ID_PATTERN = /^[a-zA-Z0-9-]{12,80}$/;
const MAX_PROMPT_LENGTH = 12000;
const MAX_NEGATIVE_PROMPT_LENGTH = 6000;
const MAX_URL_LENGTH = 4000;

type MessageRecord = Record<string, unknown>;

export type PromptLensDraft = {
  prompt: string;
  negativePrompt: string;
  sourceImageUrl: string;
  sourcePageUrl: string;
};

function isRecord(value: unknown): value is MessageRecord {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeText(value: unknown, maxLength: number): string {
  return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function normalizeHttpUrl(value: unknown): string {
  const text = normalizeText(value, MAX_URL_LENGTH);
  if (!text) return '';

  try {
    const url = new URL(text);
    return url.protocol === 'http:' || url.protocol === 'https:' ? url.toString() : '';
  } catch {
    return '';
  }
}

function normalizeDraft(value: unknown): PromptLensDraft | null {
  if (!isRecord(value)) return null;

  const draft = {
    prompt: normalizeText(value.prompt, MAX_PROMPT_LENGTH),
    negativePrompt: normalizeText(value.negativePrompt, MAX_NEGATIVE_PROMPT_LENGTH),
    sourceImageUrl: normalizeHttpUrl(value.sourceImageUrl),
    sourcePageUrl: normalizeHttpUrl(value.sourcePageUrl),
  };

  return draft.prompt ? draft : null;
}

export function usePromptLensDraft(): PromptLensDraft | null {
  const [draft, setDraft] = useState<PromptLensDraft | null>(null);

  useEffect(() => {
    const draftId = new URLSearchParams(window.location.search).get(DRAFT_PARAM)?.trim() || '';
    if (!DRAFT_ID_PATTERN.test(draftId)) return;

    let accepted = false;
    const receiveDraft = (event: MessageEvent<unknown>) => {
      if (event.source !== window || event.origin !== window.location.origin) return;
      if (!isRecord(event.data)) return;
      if (event.data.source !== EXTENSION_SOURCE || event.data.type !== 'promptlens-draft') return;
      if (event.data.draftId !== draftId || accepted) return;

      const normalized = normalizeDraft(event.data.draft);
      if (!normalized) return;

      accepted = true;
      setDraft(normalized);
      window.postMessage(
        {
          source: PAGE_SOURCE,
          type: 'promptlens-draft-accepted',
          draftId,
        },
        window.location.origin,
      );
    };

    window.addEventListener('message', receiveDraft);
    window.postMessage(
      {
        source: PAGE_SOURCE,
        type: 'promptlens-ready',
        draftId,
      },
      window.location.origin,
    );

    return () => window.removeEventListener('message', receiveDraft);
  }, []);

  return draft;
}
