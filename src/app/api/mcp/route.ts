import { WebStandardStreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js';
import { createOpenPromptsMcpServer } from '~/lib/mcp/server';

export const dynamic = 'force-dynamic';

function configuredApiKey(): string {
  return String(process.env.MCP_API_KEY || '').trim();
}

function constantTimeEqual(left: string, right: string): boolean {
  const maxLength = Math.max(left.length, right.length);
  let difference = left.length ^ right.length;
  for (let index = 0; index < maxLength; index += 1) {
    difference |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }
  return difference === 0;
}

function hasValidApiKey(request: Request): boolean {
  const expected = configuredApiKey();
  const authorization = request.headers.get('authorization') || '';
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  return Boolean(expected && match?.[1] && constantTimeEqual(match[1].trim(), expected));
}

function corsHeaders(request: Request): Headers {
  const headers = new Headers({
    'access-control-allow-headers': 'Authorization, Content-Type, Accept, MCP-Protocol-Version, MCP-Session-Id, Last-Event-ID',
    'access-control-allow-methods': 'GET, POST, DELETE, OPTIONS',
    'access-control-expose-headers': 'MCP-Session-Id, Last-Event-ID',
    vary: 'Origin',
  });
  const allowedOrigin = String(process.env.MCP_ALLOWED_ORIGIN || '').trim();
  const requestOrigin = request.headers.get('origin');
  if (allowedOrigin && requestOrigin === allowedOrigin) {
    headers.set('access-control-allow-origin', allowedOrigin);
  }
  return headers;
}

function withCors(response: Response, request: Request): Response {
  const headers = corsHeaders(request);
  response.headers.forEach((value, key) => headers.set(key, value));
  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

async function handleMcpRequest(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return withCors(new Response(null, { status: 204 }), request);
  }

  if (!configuredApiKey()) {
    return withCors(
      Response.json({ error: 'MCP_API_KEY is not configured.' }, { status: 503 }),
      request,
    );
  }

  if (!hasValidApiKey(request)) {
    return withCors(
      Response.json({ error: 'Missing or invalid MCP API key.' }, { status: 401 }),
      request,
    );
  }

  const server = createOpenPromptsMcpServer();
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
  });
  await server.connect(transport);
  const response = await transport.handleRequest(request);
  return withCors(response, request);
}

export async function GET(request: Request): Promise<Response> {
  return handleMcpRequest(request);
}

export async function POST(request: Request): Promise<Response> {
  return handleMcpRequest(request);
}

export async function DELETE(request: Request): Promise<Response> {
  return handleMcpRequest(request);
}

export async function OPTIONS(request: Request): Promise<Response> {
  return handleMcpRequest(request);
}