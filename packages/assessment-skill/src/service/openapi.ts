import { skillHttpRoutes } from '../contracts/http';
import type { AssessmentSkillServiceConfig } from './config';

export function buildOpenApiDocument(config: AssessmentSkillServiceConfig) {
  const paths = Object.fromEntries(
    skillHttpRoutes.map((route) => {
      const openApiPath = route.path.replace(/:([A-Za-z0-9_]+)/g, '{$1}');
      return [
        openApiPath,
        {
          ...(route.method === 'GET' ? { get: createOperation(route) } : {}),
          ...(route.method === 'POST' ? { post: createOperation(route) } : {}),
          ...(route.method === 'DELETE' ? { delete: createOperation(route) } : {}),
        },
      ];
    })
  );

  return {
    openapi: '3.1.0',
    info: {
      title: config.serviceName,
      version: config.version,
      description: 'Standalone assessment skill service skeleton for scales, voice intent, member context, and OpenClaw integration.',
    },
    servers: [
      {
        url: `${config.basePath || ''}`,
      },
    ],
    paths,
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'AST',
        },
      },
    },
  };
}

function createOperation(route: { summary: string; auth: 'public' | 'agent'; scope?: string }) {
  return {
    summary: route.summary,
    security: route.auth === 'agent' ? [{ bearerAuth: [] }] : [],
    responses: {
      '200': {
        description: 'Success',
      },
      '401': {
        description: 'Unauthorized',
      },
      '403': {
        description: 'Forbidden',
      },
      '500': {
        description: 'Internal server error',
      },
    },
    ...(route.scope
      ? {
          'x-agent-scope': route.scope,
        }
      : {}),
  };
}
