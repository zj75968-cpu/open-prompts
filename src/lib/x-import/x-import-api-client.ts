import { requestJson, type JsonResponse } from '~/lib/api/json-client';
import { localeApiPath } from '~/lib/locale-api-path';
import type {
  XImportRequestDto,
  XImportResponseDto,
  XSourceCheckApiResponseDto,
  XSourceCheckQueryDto,
} from '~/lib/x-import/x-import-dto';

function sourceCheckQuery(query: XSourceCheckQueryDto): string {
  const search = new URLSearchParams({ url: query.url });
  if (query.excludeId) search.set('excludeId', String(query.excludeId));
  return search.toString();
}

export function checkImportedXSource(
  locale: string,
  query: XSourceCheckQueryDto,
): Promise<JsonResponse<XSourceCheckApiResponseDto>> {
  return requestJson(
    localeApiPath(locale, `/api/x-import/check?${sourceCheckQuery(query)}`),
    { cache: 'no-store' },
  );
}

export function importXStatus(
  locale: string,
  body: XImportRequestDto,
): Promise<JsonResponse<XImportResponseDto>> {
  return requestJson<XImportResponseDto, XImportRequestDto>(
    localeApiPath(locale, '/api/x-import'),
    { method: 'POST', body },
  );
}