import {
  loadPromptTemplateForEdit,
  savePromptTemplate,
} from '~/lib/prompts/prompt-api-client';
import {
  checkImportedXSource,
  importXStatus,
} from '~/lib/x-import/x-import-api-client';
import type {
  LoadTemplateResponse,
  SubmitFormPayload,
  SubmitTemplateResponse,
  XImportResponse,
} from './submit-types';

export async function checkXSourceDuplicate(params: {
  locale: string;
  url: string;
  editId?: number | null;
}) {
  const response = await checkImportedXSource(params.locale, {
    url: params.url,
    excludeId: params.editId ?? undefined,
  });
  return {
    ok: response.ok,
    duplicate: response.data.duplicate ?? null,
  };
}

export async function loadTemplateForEdit(locale: string, editId: number) {
  const response = await loadPromptTemplateForEdit(locale, editId);
  return {
    ok: response.ok,
    status: response.status,
    data: response.data as LoadTemplateResponse,
  };
}

export async function importTemplateFromX(locale: string, url: string) {
  const response = await importXStatus(locale, { url });
  return {
    ok: response.ok,
    status: response.status,
    data: response.data as XImportResponse,
  };
}

export async function saveSubmittedTemplate(params: {
  locale: string;
  editId: number | null;
  isAuthenticated: boolean;
  payload: SubmitFormPayload;
}) {
  const response = await savePromptTemplate(params);
  return {
    ok: response.ok,
    status: response.status,
    data: response.data as SubmitTemplateResponse,
  };
}