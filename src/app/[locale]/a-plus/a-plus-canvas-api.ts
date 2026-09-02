import { requestJson } from '~/lib/api/json-client';
import { localeApiPath } from '~/lib/locale-api-path';
import type {
  APlusCanvasApiResponse,
  APlusCanvasEditRequest,
  APlusCanvasEditResponse,
} from '~/lib/a-plus/a-plus-domain';

export async function editAPlusCanvas(
  locale: string,
  request: APlusCanvasEditRequest,
): Promise<APlusCanvasEditResponse> {
  const response = await requestJson<APlusCanvasApiResponse, APlusCanvasEditRequest>(
    localeApiPath(locale, '/api/a-plus/canvas/edit'),
    {
      method: 'POST',
      body: request,
    },
  );

  if (!response.ok || 'error' in response.data) {
    throw new Error('error' in response.data ? response.data.error : `Canvas edit failed (${response.status})`);
  }
  return response.data;
}