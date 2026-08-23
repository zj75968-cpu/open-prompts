export type JsonRequestOptions<TBody> = Omit<RequestInit, 'body' | 'headers'> & {
  body?: TBody;
  headers?: HeadersInit;
};

export type JsonResponse<T> = {
  ok: boolean;
  status: number;
  data: T;
};

function withJsonContentType(headers: HeadersInit | undefined, hasBody: boolean): Headers {
  const normalized = new Headers(headers);
  if (hasBody && !normalized.has('Content-Type')) {
    normalized.set('Content-Type', 'application/json');
  }
  return normalized;
}

export async function requestJson<TResponse, TBody = never>(
  endpoint: string,
  options: JsonRequestOptions<TBody> = {},
): Promise<JsonResponse<TResponse>> {
  const hasBody = options.body !== undefined;
  const response = await fetch(endpoint, {
    ...options,
    headers: withJsonContentType(options.headers, hasBody),
    body: hasBody ? JSON.stringify(options.body) : undefined,
  });

  const data = (await response.json().catch(() => ({}))) as TResponse;
  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}