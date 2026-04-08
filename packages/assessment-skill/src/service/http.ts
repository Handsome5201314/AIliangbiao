import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import type { AssessmentSkillServiceConfig } from './config';
import { buildMcpManifest } from './mcp-manifest';
import { buildOpenApiDocument } from './openapi';

function sendJson(response: ServerResponse, statusCode: number, payload: unknown) {
  const body = JSON.stringify(payload, null, 2);
  response.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(body),
  });
  response.end(body);
}

function notImplemented(response: ServerResponse, message: string) {
  sendJson(response, 501, {
    error: 'Not implemented in standalone skeleton',
    message,
  });
}

export function createAssessmentSkillHttpServer(config: AssessmentSkillServiceConfig) {
  const openapi = buildOpenApiDocument(config);
  const manifest = buildMcpManifest();

  return createServer(async (request: IncomingMessage, response: ServerResponse) => {
    const method = request.method || 'GET';
    const url = new URL(request.url || '/', `http://127.0.0.1:${config.port}`);
    const pathname = url.pathname;

    if (method === 'GET' && pathname === '/healthz') {
      return sendJson(response, 200, {
        status: 'ok',
        service: config.serviceName,
        version: config.version,
      });
    }

    if (method === 'GET' && pathname === '/readyz') {
      return sendJson(response, 200, {
        status: 'ready',
        service: config.serviceName,
        environment: config.environment,
      });
    }

    if (method === 'GET' && pathname === '/openapi.json') {
      return sendJson(response, 200, openapi);
    }

    if (method === 'GET' && pathname === '/mcp/manifest.json') {
      return sendJson(response, 200, manifest);
    }

    if (pathname.startsWith('/v1/')) {
      return notImplemented(
        response,
        'This standalone skeleton exposes contracts and service metadata. Wire host-specific adapters to serve live data.'
      );
    }

    return sendJson(response, 404, {
      error: 'Not found',
      path: pathname,
    });
  });
}
