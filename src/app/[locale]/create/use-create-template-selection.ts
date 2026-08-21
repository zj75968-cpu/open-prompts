'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import type { PromptGalleryItem } from '~/lib/prompts/prompt-model';

export function useCreateTemplateSelection(prompts: PromptGalleryItem[]) {
  const searchParams = useSearchParams();
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string>(prompts[0]?.id ?? '');

  const item = useMemo(() => {
    const found = prompts.find((prompt) => prompt.id === selectedId);
    return found ?? prompts[0];
  }, [prompts, selectedId]);

  useEffect(() => {
    if (!searchParams) return;
    const idFromUrl =
      searchParams.get('template') ||
      searchParams.get('templateId') ||
      searchParams.get('id');
    if (!idFromUrl || !prompts.some((prompt) => prompt.id === idFromUrl)) return;

    setSelectedId(idFromUrl);
    document
      .getElementById('op-create-prompt')
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, [prompts, searchParams]);

  const filteredTemplates = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    if (!normalizedQuery) return prompts;

    return prompts.filter((prompt) =>
      prompt.title.toLowerCase().includes(normalizedQuery) ||
      prompt.description.toLowerCase().includes(normalizedQuery) ||
      prompt.prompt.toLowerCase().includes(normalizedQuery) ||
      prompt.tags.some((tag) => tag.toLowerCase().includes(normalizedQuery)),
    );
  }, [prompts, query]);

  const heroCarouselItems = useMemo(() => {
    const picked = prompts.slice(0, 8).filter((prompt) => prompt.id && prompt.title);
    return picked.length ? picked : prompts.slice(0, 1);
  }, [prompts]);

  return {
    query,
    setQuery,
    selectedId,
    setSelectedId,
    item,
    filteredTemplates,
    heroCarouselItems,
  };
}