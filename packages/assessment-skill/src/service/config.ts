export interface AssessmentSkillServiceConfig {
  serviceName: string;
  version: string;
  port: number;
  basePath: string;
  environment: string;
}

export function getAssessmentSkillServiceConfig(
  env: NodeJS.ProcessEnv = process.env
): AssessmentSkillServiceConfig {
  return {
    serviceName: env.ASSESSMENT_SKILL_SERVICE_NAME || '@ailiangbiao/assessment-skill',
    version: env.ASSESSMENT_SKILL_VERSION || '0.1.0',
    port: Number(env.ASSESSMENT_SKILL_PORT || env.PORT || 4318),
    basePath: env.ASSESSMENT_SKILL_BASE_PATH || '',
    environment: env.NODE_ENV || 'development',
  };
}
