export function buildMcpManifest() {
  return {
    server: {
      name: '@ailiangbiao/assessment-skill',
      version: '0.1.0',
      description: 'Assessment skill service for scales, member context, memory summary, and deterministic evaluation.',
    },
    tools: [
      { name: 'recommend_scale', scope: 'skill:scales:read' },
      { name: 'get_scale_questions', scope: 'skill:scales:read' },
      { name: 'submit_and_evaluate', scope: 'skill:scales:evaluate' },
      { name: 'start_assessment_session', scope: 'skill:scales:evaluate' },
      { name: 'get_current_question', scope: 'skill:scales:read' },
      { name: 'submit_answer', scope: 'skill:scales:evaluate' },
      { name: 'get_assessment_result', scope: 'skill:scales:read' },
      { name: 'get_active_member_context', scope: 'skill:member:read' },
      { name: 'get_member_assessment_summary', scope: 'skill:member:read' },
      { name: 'get_member_memory_summary', scope: 'skill:member:read' },
      { name: 'append_member_memory_note', scope: 'skill:memory:write' },
      { name: 'voice_intent', scope: 'skill:voice-intent' },
    ],
  };
}
