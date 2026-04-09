import fs from 'node:fs';
import path from 'node:path';

const rootDir = process.cwd();

const SCALE_CONFIGS = [
  {
    id: 'SRS',
    filePath: path.join(rootDir, 'data', 'scale-content', 'srs.content.json'),
    expectedQuestionCount: 65,
    expectedOptionCount: 4,
    expectedLabels: ['从不', '偶尔', '经常', '总是'],
  },
  {
    id: 'ABC',
    filePath: path.join(rootDir, 'data', 'scale-content', 'abc.content.json'),
    expectedQuestionCount: 57,
    expectedOptionCount: 2,
    expectedLabels: ['否', '是'],
  },
  {
    id: 'SNAP-IV',
    filePath: path.join(rootDir, 'data', 'scale-content', 'snap-iv.content.json'),
    expectedQuestionCount: 26,
    expectedOptionCount: 4,
    expectedLabels: ['无', '有一点点', '还算不少', '非常多'],
  },
  {
    id: 'CARS',
    filePath: path.join(rootDir, 'data', 'scale-content', 'cars.content.json'),
    expectedQuestionCount: 15,
    expectedOptionCount: 4,
    expectedLabels: [
      '1分：与年龄相当 (正常)',
      '2分：轻度异常 (偶尔、轻微)',
      '3分：中度异常 (经常、需要干预)',
      '4分：严重异常 (极频、难以打断)',
    ],
  },
];

function validateString(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function pushIssue(issues, scaleId, message) {
  issues.push(`[${scaleId}] ${message}`);
}

function validateScaleContent(config) {
  const issues = [];
  if (!fs.existsSync(config.filePath)) {
    pushIssue(issues, config.id, `missing file: ${config.filePath}`);
    return issues;
  }

  let payload;
  try {
    const raw = fs.readFileSync(config.filePath, 'utf8').replace(/^\uFEFF/, '');
    payload = JSON.parse(raw);
  } catch (error) {
    pushIssue(issues, config.id, `invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
    return issues;
  }

  if (!validateString(payload?.version)) {
    pushIssue(issues, config.id, 'missing or empty "version"');
  }

  if (!Array.isArray(payload?.questions)) {
    pushIssue(issues, config.id, '"questions" must be an array');
    return issues;
  }

  if (payload.questions.length !== config.expectedQuestionCount) {
    pushIssue(
      issues,
      config.id,
      `expected ${config.expectedQuestionCount} questions, received ${payload.questions.length}`
    );
  }

  const seenIds = new Set();
  payload.questions.forEach((question, index) => {
    const expectedId = index + 1;
    const prefix = `question ${expectedId}`;

    if (typeof question?.id !== 'number') {
      pushIssue(issues, config.id, `${prefix} is missing numeric "id"`);
      return;
    }

    if (question.id !== expectedId) {
      pushIssue(issues, config.id, `${prefix} expected id ${expectedId}, received ${question.id}`);
    }

    if (seenIds.has(question.id)) {
      pushIssue(issues, config.id, `${prefix} has duplicated id ${question.id}`);
    }
    seenIds.add(question.id);

    if (!validateString(question.text)) {
      pushIssue(issues, config.id, `${prefix} is missing "text"`);
    }
    if (!validateString(question.clinical_intent)) {
      pushIssue(issues, config.id, `${prefix} is missing "clinical_intent"`);
    }
    if (!validateString(question.colloquial)) {
      pushIssue(issues, config.id, `${prefix} is missing "colloquial"`);
    }
    if (!Array.isArray(question.fallback_examples)) {
      pushIssue(issues, config.id, `${prefix} "fallback_examples" must be an array`);
    }
    if (question.notes !== undefined && typeof question.notes !== 'string') {
      pushIssue(issues, config.id, `${prefix} "notes" must be a string when provided`);
    }
    if (Object.prototype.hasOwnProperty.call(question, 'score')) {
      pushIssue(issues, config.id, `${prefix} must not define "score" at question level`);
    }

    if (!Array.isArray(question.options)) {
      pushIssue(issues, config.id, `${prefix} "options" must be an array`);
      return;
    }

    if (question.options.length !== config.expectedOptionCount) {
      pushIssue(
        issues,
        config.id,
        `${prefix} expected ${config.expectedOptionCount} options, received ${question.options.length}`
      );
      return;
    }

    question.options.forEach((option, optionIndex) => {
      const optionPrefix = `${prefix} option ${optionIndex + 1}`;
      if (!validateString(option?.label)) {
        pushIssue(issues, config.id, `${optionPrefix} is missing "label"`);
      }
      if (option.description !== undefined && typeof option.description !== 'string') {
        pushIssue(issues, config.id, `${optionPrefix} "description" must be a string when provided`);
      }
      if (option.aliases !== undefined && !Array.isArray(option.aliases)) {
        pushIssue(issues, config.id, `${optionPrefix} "aliases" must be an array when provided`);
      }
      if (Object.prototype.hasOwnProperty.call(option, 'score')) {
        pushIssue(issues, config.id, `${optionPrefix} must not define "score"`);
      }

      const expectedLabel = config.expectedLabels[optionIndex];
      if (expectedLabel && option.label !== expectedLabel) {
        pushIssue(
          issues,
          config.id,
          `${optionPrefix} expected label "${expectedLabel}", received "${option.label}"`
        );
      }
    });
  });

  return issues;
}

const allIssues = SCALE_CONFIGS.flatMap(validateScaleContent);

if (allIssues.length) {
  console.error('Scale content validation failed:');
  allIssues.forEach((issue) => console.error(`- ${issue}`));
  process.exitCode = 1;
} else {
  console.log('Scale content validation passed for:');
  SCALE_CONFIGS.forEach((config) => {
    console.log(`- ${config.id}`);
  });
}
