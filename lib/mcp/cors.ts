const MCP_ALLOWED_HEADERS = [
  'Authorization',
  'Content-Type',
  'X-Session-Id',
  'Mcp-Session-Id',
  'MCP-Protocol-Version',
  'Last-Event-ID',
].join(', ');

const MCP_EXPOSED_HEADERS = [
  'X-Session-Id',
  'Mcp-Session-Id',
  'MCP-Protocol-Version',
].join(', ');

export const mcpCorsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': MCP_ALLOWED_HEADERS,
  'Access-Control-Expose-Headers': MCP_EXPOSED_HEADERS,
};

export function withMcpCors<T extends Response>(response: T): T {
  Object.entries(mcpCorsHeaders).forEach(([key, value]) => {
    response.headers.set(key, value);
  });
  return response;
}

export function createMcpOptionsResponse() {
  return new Response(null, {
    status: 204,
    headers: mcpCorsHeaders,
  });
}
