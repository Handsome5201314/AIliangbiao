export function buildMcpManifest() {
  return {
    server: {
      name: '@ailiangbiao/assessment-skill',
      version: '0.1.0',
      description: 'Deterministic local assessment service with MCP tools for session-based scale execution.',
    },
    tools: [
      { name: 'recommend_assessment', scope: 'skill:scales:read' },
      { name: 'recommend_scale', scope: 'skill:scales:read' },
      { name: 'get_scale_questions', scope: 'skill:scales:read' },
      { name: 'create_assessment_session', scope: 'skill:scales:evaluate' },
      { name: 'get_current_question', scope: 'skill:scales:read' },
      { name: 'submit_answer', scope: 'skill:scales:evaluate' },
      { name: 'get_assessment_result', scope: 'skill:scales:read' },
      { name: 'pause_assessment_session', scope: 'skill:scales:evaluate' },
      { name: 'resume_assessment_session', scope: 'skill:scales:evaluate' },
      { name: 'cancel_assessment_session', scope: 'skill:scales:evaluate' },
      { name: 'submit_and_evaluate', scope: 'skill:scales:evaluate' },
      { name: 'add_growth_record', scope: 'skill:scales:evaluate' },
      { name: 'get_growth_history', scope: 'skill:scales:read' },
      { name: 'evaluate_growth', scope: 'skill:scales:read' },
      { name: 'get_active_member_context', scope: 'skill:member:read' },
      { name: 'get_member_assessment_summary', scope: 'skill:member:read' },
      { name: 'voice_intent', scope: 'skill:voice-intent' },
    ],
  };
}
