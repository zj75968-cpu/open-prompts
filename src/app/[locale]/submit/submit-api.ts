import { localeApiPath } from '~/lib/locale-api-path';
import type { TemplateRecord } from '~/lib/prompts/template-types';
import type { XSourceDuplicate } from '~/lib/x-import/x-source-duplicate';
import type { LoadTemplateResponse, SubmitFormPayload, SubmitTemplateResponse, XImportResponse } from './submit-types';

async function readJson<T>(res: Response): Promise<T> {
  return (await res.json().catch(() => ({}))) as T;
}

export async function checkXSourceDuplicate(params: {
  locale: string;
  url: string;
  editId?: number | null;
}) {
  const q = new URLSearchParams({ url: params.url });
  if (params.editId) q.set('excludeId', String(params.editId));
  const res = await fetch(localeApiPath(params.locale, `/api/x-import/check?${q}`), {
    cache: 'no-store',
  });
  const data = await readJson<{ duplicate?: XSourceDuplicate | null }>(res);
  return { ok: res.ok, duplicate: data.duplicate ?? null };
}

export async function loadTemplateForEdit(locale: string, editId: number) {
  const res = await fetch(localeApiPath(locale, `/api/my/templates/${editId}`), { cache: 'no-store' });
  const data = await readJson<LoadTemplateResponse>(res);
  return { ok: res.ok, status: res.status, data };
}

export async function importTemplateFromX(locale: string, url: string) {
  const res = await fetch(localeApiPath(locale, '/api/x-import'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  const data = await readJson<XImportResponse>(res);
  return { ok: res.ok, status: res.status, data };
}

export async function saveSubmittedTemplate(params: {
  locale: string;
  editId: number | null;
  isAuthenticated: boolean;
  payload: SubmitFormPayload;
}) {
  const submitPath =
    params.editId !== null
      ? localeApiPath(params.locale, `/api/my/templates/${params.editId}`)
      : params.isAuthenticated
        ? localeApiPath(params.locale, '/api/my/templates')
        : localeApiPath(params.locale, '/api/prompts');

  const res = await fetch(submitPath, {
    method: params.editId !== null ? 'PATCH' : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params.payload),
  });
  const data = await readJson<SubmitTemplateResponse & { item?: TemplateRecord }>(res);
  return { ok: res.ok, status: res.status, data };
}