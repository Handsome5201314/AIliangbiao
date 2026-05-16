import { NextRequest } from 'next/server';

import { extractBearerToken, requireAgentScope, type AgentScope, verifyAgentSessionToken } from './auth';

export function authenticateSkillRequest(request: NextRequest, scope: AgentScope) {
  const token = extractBearerToken(request);
  const session = verifyAgentSessionToken(token);
  requireAgentScope(session, scope);
  return session;
}
