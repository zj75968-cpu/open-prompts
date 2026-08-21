import { useCallback, useEffect, useState } from 'react';
import { authorHandleFromXUrl, resolveXAuthorHandle } from '~/lib/x-import/x-author-handle';
import { parseXStatusUrl } from '~/lib/x-import/parse-x-status-url';
import type { XSourceDuplicate } from '~/lib/x-import/x-source-duplicate';
import { checkXSourceDuplicate, importTemplateFromX } from './submit-api';
import { MAX_TITLE, type XImportFormValues } from './submit-types';

type XImportMessages = {
  notTweet: string;
  duplicate: string;
  generic: string;
};

export function useXImportWorkflow({
  locale,
  editId,
  url,
  messages,
  onUrlChange,
  onAuthorHandleChange,
  onImported,
}: {
  locale: string;
  editId: number | null;
  url: string;
  messages: XImportMessages;
  onUrlChange: (value: string) => void;
  onAuthorHandleChange: (value: string) => void;
  onImported: (values: XImportFormValues) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);
  const [duplicate, setDuplicate] = useState<XSourceDuplicate | null>(null);

  useEffect(() => {
    const sourceUrl = url.trim();
    if (!parseXStatusUrl(sourceUrl)) {
      setDuplicate(null);
      return;
    }

    const handle = authorHandleFromXUrl(sourceUrl);
    if (handle) onAuthorHandleChange(handle);

    const request = new AbortController();
    const timer = window.setTimeout(() => {
      void checkXSourceDuplicate({ locale, url: sourceUrl, editId })
        .then((result) => {
          if (!request.signal.aborted && result.ok) setDuplicate(result.duplicate);
        })
        .catch(() => {
          /* Debounced duplicate checks are best effort. */
        });
    }, 450);

    return () => {
      window.clearTimeout(timer);
      request.abort();
    };
  }, [editId, locale, onAuthorHandleChange, url]);

  const changeImportUrl = useCallback(
    (value: string) => {
      onUrlChange(value);
      setError(null);
      setSucceeded(false);
      setDuplicate(null);
    },
    [onUrlChange],
  );

  const changeSourceUrl = useCallback(
    (value: string) => {
      onUrlChange(value);
      setDuplicate(null);
    },
    [onUrlChange],
  );

  const runImport = useCallback(async () => {
    setError(null);
    setSucceeded(false);
    const sourceUrl = url.trim();
    if (!sourceUrl) return;
    if (!parseXStatusUrl(sourceUrl)) {
      setError(messages.notTweet);
      return;
    }

    const sourceHandle = authorHandleFromXUrl(sourceUrl);
    if (sourceHandle) onAuthorHandleChange(sourceHandle);
    setBusy(true);
    try {
      const result = await importTemplateFromX(locale, sourceUrl);
      const data = result.data;
      if (result.status === 409 && data.error === 'duplicate_x_source' && data.duplicate) {
        setDuplicate(data.duplicate);
        setError(messages.duplicate);
        return;
      }
      if (!result.ok) {
        setError(data.error || messages.generic);
        return;
      }

      onImported({
        title: typeof data.title === 'string' ? data.title.slice(0, MAX_TITLE) : undefined,
        description: typeof data.description === 'string' ? data.description.slice(0, 120) : undefined,
        prompt: typeof data.prompt === 'string' ? data.prompt : undefined,
        images: Array.isArray(data.imageUrls) ? data.imageUrls : undefined,
        sourceUrl: typeof data.sourceUrl === 'string' ? data.sourceUrl : undefined,
        authorHandle:
          resolveXAuthorHandle({
            sourceUrl: typeof data.sourceUrl === 'string' ? data.sourceUrl : sourceUrl,
            screenName:
              typeof data.authorHandle === 'string' ? data.authorHandle.replace(/^@+/, '') : null,
          }) || sourceHandle || '',
      });
      setDuplicate(null);
      setSucceeded(true);
    } catch {
      setError(messages.generic);
    } finally {
      setBusy(false);
    }
  }, [locale, messages, onAuthorHandleChange, onImported, url]);

  const resetFeedback = useCallback(() => {
    setError(null);
    setSucceeded(false);
  }, []);

  return {
    busy,
    error,
    succeeded,
    duplicate,
    setDuplicate,
    changeImportUrl,
    changeSourceUrl,
    runImport,
    resetFeedback,
  };
}