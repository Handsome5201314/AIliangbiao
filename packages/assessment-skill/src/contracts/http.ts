export type SkillRouteDescriptor = {
  method: 'GET' | 'POST' | 'DELETE';
  path: string;
  summary: string;
  auth: 'public' | 'agent';
  scope?: string;
};

export const skillHttpRoutes: SkillRouteDescriptor[] = [
  { method: 'GET', path: '/healthz', summary: 'Liveness probe', auth: 'public' },
  { method: 'GET', path: '/readyz', summary: 'Readiness probe', auth: 'public' },
  { method: 'GET', path: '/openapi.json', summary: 'OpenAPI document', auth: 'public' },
  { method: 'GET', path: '/mcp/manifest.json', summary: 'MCP tool manifest', auth: 'public' },
  { method: 'GET', path: '/v1/scales', summary: 'List scales', auth: 'agent', scope: 'skill:scales:read' },
  { method: 'GET', path: '/v1/scales/:scaleId', summary: 'Get scale detail', auth: 'agent', scope: 'skill:scales:read' },
  { method: 'POST', path: '/v1/scales/:scaleId/evaluate', summary: 'Evaluate and persist answers', auth: 'agent', scope: 'skill:scales:evaluate' },
  { method: 'POST', path: '/v1/scales/:scaleId/analyze-conversation', summary: 'Extract draft answers from chat history', auth: 'agent', scope: 'skill:scales:read' },
  { method: 'POST', path: '/v1/voice-intent', summary: 'Resolve questionnaire or triage intent', auth: 'agent', scope: 'skill:voice-intent' },
  { method: 'POST', path: '/v1/speech/transcribe', summary: 'Speech-to-text proxy', auth: 'agent', scope: 'skill:voice-intent' },
  { method: 'GET', path: '/v1/me/quota', summary: 'Get current user quota', auth: 'agent', scope: 'skill:member:read' },
  { method: 'GET', path: '/v1/profile/sync', summary: 'Load current profile state by device', auth: 'public' },
  { method: 'POST', path: '/v1/profile/sync', summary: 'Create or update member profile', auth: 'public' },
  { method: 'POST', path: '/v1/account/upgrade', summary: 'Upgrade guest to registered account', auth: 'public' },
  { method: 'GET', path: '/v1/me/members', summary: 'List accessible members', auth: 'agent', scope: 'skill:member:read' },
  { method: 'GET', path: '/v1/me/members/:memberId/context', summary: 'Get member context', auth: 'agent', scope: 'skill:member:read' },
  { method: 'GET', path: '/v1/me/members/:memberId/assessment-summary', summary: 'Get member assessment summary', auth: 'agent', scope: 'skill:member:read' },
  { method: 'GET', path: '/v1/me/members/:memberId/memory-summary', summary: 'Get member memory summary', auth: 'agent', scope: 'skill:member:read' },
  { method: 'POST', path: '/v1/me/members/:memberId/memory-notes', summary: 'Append structured memory notes', auth: 'agent', scope: 'skill:memory:write' },
  { method: 'POST', path: '/v1/me/members/:memberId/advice', summary: 'Generate member-specific advice', auth: 'agent', scope: 'skill:member:read' },
];
