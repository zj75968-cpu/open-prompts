import { useCallback, useEffect, useState } from 'react';
import type { SubmitFormValues } from './submit-types';
import { loadTemplateForEdit } from './submit-api';
import { templateToSubmitFormValues } from './submit-utils';

export function useEditTemplateWorkflow({
  locale,
  editId,
  enabled,
  loadFailedMessage,
  onTemplateLoaded,
}: {
  locale: string;
  editId: number | null;
  enabled: boolean;
  loadFailedMessage: string;
  onTemplateLoaded: (values: SubmitFormValues) => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    if (!editId) return;
    setLoading(true);
    setError(null);
    try {
      const result = await loadTemplateForEdit(locale, editId);
      if (!result.ok || !result.data.item) {
        setError(result.data.error ?? `HTTP ${result.status}`);
        return;
      }
      onTemplateLoaded(templateToSubmitFormValues(result.data.item));
    } catch {
      setError(loadFailedMessage);
    } finally {
      setLoading(false);
    }
  }, [editId, loadFailedMessage, locale, onTemplateLoaded]);

  useEffect(() => {
    if (!enabled) return;
    void reload();
  }, [enabled, reload]);

  return {
    loading,
    error,
    reload,
  };
}