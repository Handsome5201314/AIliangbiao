import { createAssessmentSkillHttpServer } from './service/http';
import { getAssessmentSkillServiceConfig } from './service/config';

const config = getAssessmentSkillServiceConfig();
const server = createAssessmentSkillHttpServer(config);

server.listen(config.port, () => {
  // eslint-disable-next-line no-console
  console.log(`[assessment-skill] listening on http://127.0.0.1:${config.port}`);
});
