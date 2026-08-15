import { useEffect, useRef, useState } from 'react';
import type { GenerationHistoryEntry, GenerationUiState } from './types';

const HISTORY_STORAGE_KEY = 'op_create_history';
const HISTORY_LIMIT = 30;

function isHistoryRecord(raw: unknown): raw is Record<string, unknown> {
  return typeof raw === 'object' && raw !== null;
}

function normalizeHistoryEntry(raw: unknown): GenerationHistoryEntry | null {
  if (!isHistoryRecord(raw)) return null;
  const entry: GenerationHistoryEntry = {
    id: String(raw.id || ''),
    createdAt: Number(raw.createdAt || Date.now()),
    providerJobId: raw.providerJobId ? String(raw.providerJobId) : null,
    prompt: String(raw.prompt || ''),
    model: String(raw.model || ''),
    provider: String(raw.provider || ''),
    aspectRatio: String(raw.aspectRatio || ''),
    quality: String(raw.quality || ''),
    count: Number(raw.count || 1),
    images: Array.isArray(raw.images) ? raw.images.filter((url): url is string => typeof url === 'string') : [],
  };
  return entry.id && entry.prompt ? entry : null;
}

export function useGenerationHistory(snapshot: {
  uiState: GenerationUiState;
  images: string[];
  providerJobId: string | null;
  prompt: string;
  model: string;
  provider: string;
  aspectRatio: string;
  quality: string;
  count: number;
}) {
  const [history, setHistory] = useState<GenerationHistoryEntry[]>([]);
  const hydrateSaveSkipRef = useRef(true);
  const lastSavedJobRef = useRef<string | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return;
      const cleaned = parsed
        .map(normalizeHistoryEntry)
        .filter((entry): entry is GenerationHistoryEntry => Boolean(entry));
      if (cleaned.length) setHistory(cleaned.slice(0, HISTORY_LIMIT));
    } catch {
      // History is non-critical; ignore malformed or blocked storage.
    }
  }, []);

  useEffect(() => {
    if (hydrateSaveSkipRef.current) {
      hydrateSaveSkipRef.current = false;
      return;
    }
    try {
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(history.slice(0, HISTORY_LIMIT)));
    } catch {
      // Keep runtime history even if persistence is unavailable.
    }
  }, [history]);

  useEffect(() => {
    if (snapshot.uiState !== 'succeeded') return;
    if (!snapshot.images.length) return;

    const jobKey = snapshot.providerJobId ?? '__no_job__';
    if (lastSavedJobRef.current === jobKey) return;
    lastSavedJobRef.current = jobKey;

    const entry: GenerationHistoryEntry = {
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}`,
      createdAt: Date.now(),
      providerJobId: snapshot.providerJobId,
      prompt: snapshot.prompt,
      model: snapshot.model,
      provider: snapshot.provider,
      aspectRatio: snapshot.aspectRatio,
      quality: snapshot.quality,
      count: snapshot.count,
      images: snapshot.images,
    };

    setHistory((prev) => [entry, ...prev].slice(0, HISTORY_LIMIT));
  }, [
    snapshot.uiState,
    snapshot.images,
    snapshot.providerJobId,
    snapshot.prompt,
    snapshot.model,
    snapshot.provider,
    snapshot.aspectRatio,
    snapshot.quality,
    snapshot.count,
  ]);

  return { history, setHistory };
}