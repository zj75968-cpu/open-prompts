import { useCallback, useEffect, useState } from 'react';
import { isSubmitCategoryKey, type SubmitCategoryKey } from '~/lib/prompts/prompt-categories';
import type { PromptVisibility } from '~/lib/prompts/template-types';
import type { XSourceDuplicate } from '~/lib/x-import/x-source-duplicate';
import { saveSubmittedTemplate } from './submit-api';
import type { SubmitModelId } from './submit-types';
import { buildSubmitPayload } from './submit-utils';

type SubmitWorkflowValues = {
  title: string;
  description: string;
  prompt: string;
  modelId: SubmitModelId;
  category: SubmitCategoryKey | '';
  tags: string[];
  images: string[];
  sourceUrl: string;
  authorHandle: string;
  visibility: PromptVisibility;
};

type SubmitWorkflowMessages = {
  needTitle: string;
  needPrompt: string;
  needCategory: string;
  needTags: string;
  submitUnavailable: string;
  submitFailed: string;
  duplicateBlocked: (title: string) => string;
};

type ValidationIssue = {
  message: string;
  shakeId: string;
  fieldId?: string;
  tags?: boolean;
};

function findValidationIssue(
  values: Pick<SubmitWorkflowValues, 'title' | 'prompt' | 'category' | 'tags'>,
  messages: SubmitWorkflowMessages,
): ValidationIssue | null {
  if (!values.title.trim()) {
    return { message: messages.needTitle, shakeId: 'f-title', fieldId: 'f-title' };
  }
  if (values.prompt.trim().length < 10) {
    return { message: messages.needPrompt, shakeId: 'f-prompt', fieldId: 'f-prompt' };
  }
  if (!isSubmitCategoryKey(values.category)) {
    return { message: messages.needCategory, shakeId: 'f-category', fieldId: 'f-category' };
  }
  if (values.tags.length < 2 || values.tags.length > 8) {
    return { message: messages.needTags, shakeId: 'tag-wrap', tags: true };
  }
  return null;
}

function focusValidationIssue(issue: ValidationIssue) {
  if (issue.tags) {
    document.getElementById('op-tag-wrap')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    window.setTimeout(() => document.getElementById('tag-input')?.focus(), 200);
    return;
  }

  if (!issue.fieldId) return;
  const field = document.getElementById(issue.fieldId);
  field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  if (
    field instanceof HTMLInputElement ||
    field instanceof HTMLTextAreaElement ||
    field instanceof HTMLSelectElement
  ) {
    window.setTimeout(() => field.focus(), 200);
  }
}

export function useSubmitWorkflow({
  locale,
  editId,
  isAuthenticated,
  requiresAuthentication,
  values,
  messages,
  onAuthenticationRequired,
  onDuplicate,
  onSubmitted,
}: {
  locale: string;
  editId: number | null;
  isAuthenticated: boolean;
  requiresAuthentication: boolean;
  values: SubmitWorkflowValues;
  messages: SubmitWorkflowMessages;
  onAuthenticationRequired: () => void;
  onDuplicate: (duplicate: XSourceDuplicate) => void;
  onSubmitted: (id?: string | number | null) => void;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [shakeId, setShakeId] = useState<string | null>(null);
  const [blockedHint, setBlockedHint] = useState<string | null>(null);

  useEffect(() => {
    if (!shakeId) return;
    const timer = window.setTimeout(() => setShakeId(null), 1400);
    return () => window.clearTimeout(timer);
  }, [shakeId]);

  useEffect(() => {
    setBlockedHint(null);
  }, [values.title, values.description, values.prompt, values.category, values.tags]);

  const submit = useCallback(async () => {
    const issue = findValidationIssue(values, messages);
    if (issue) {
      setBlockedHint(issue.message);
      focusValidationIssue(issue);
      setShakeId(issue.shakeId);
      return;
    }

    setBlockedHint(null);
    setSubmitting(true);
    try {
      const result = await saveSubmittedTemplate({
        locale,
        editId,
        isAuthenticated,
        payload: buildSubmitPayload(values),
      });
      const data = result.data;
      if (!result.ok) {
        if (result.status === 401 && requiresAuthentication) {
          onAuthenticationRequired();
          return;
        }
        if (result.status === 409 && data.error === 'duplicate_x_source' && data.duplicate) {
          onDuplicate(data.duplicate);
          setBlockedHint(messages.duplicateBlocked(data.duplicate.title));
          return;
        }
        setBlockedHint(
          result.status === 503
            ? messages.submitUnavailable
            : typeof data.error === 'string'
              ? data.error
              : messages.submitFailed,
        );
        return;
      }
      onSubmitted(data.item?.id ?? data.id ?? editId);
    } catch {
      setBlockedHint(messages.submitFailed);
    } finally {
      setSubmitting(false);
    }
  }, [
    editId,
    isAuthenticated,
    locale,
    messages,
    onAuthenticationRequired,
    onDuplicate,
    onSubmitted,
    requiresAuthentication,
    values,
  ]);

  const clearBlockedHint = useCallback(() => {
    setBlockedHint(null);
  }, []);

  return {
    submitting,
    shakeId,
    blockedHint,
    submit,
    clearBlockedHint,
  };
}