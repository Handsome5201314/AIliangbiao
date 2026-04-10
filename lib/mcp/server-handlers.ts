import { canonicalScaleTools, handleScaleToolCall } from '@/lib/mcp/skills/scale/handlers';
import { growthTools, handleGrowthToolCall } from '@/lib/mcp/skills/growth/handlers';

const canonicalAssessmentTools = [
  ...canonicalScaleTools,
  ...growthTools,
] as const;

type CanonicalAssessmentToolName = (typeof canonicalAssessmentTools)[number]['name'];

export async function listTools() {
  return {
    tools: canonicalAssessmentTools,
  };
}

export async function handleToolCall(params: {
  name: string;
  arguments: unknown;
}): Promise<{ content: Array<{ type: string; text: string }>; isError?: boolean }> {
  let result: unknown;

  if (canonicalScaleTools.some((tool) => tool.name === params.name)) {
    result = await handleScaleToolCall(params.name as CanonicalAssessmentToolName, params.arguments);
  } else if (growthTools.some((tool) => tool.name === params.name)) {
    result = await handleGrowthToolCall(params.name, params.arguments);
  } else {
    result = {
      success: false,
      error: `Unknown tool: ${params.name}`,
      statusCode: 404,
    };
  }

  return {
    content: [
      {
        type: 'text',
        text: JSON.stringify(result, null, 2),
      },
    ],
    ...(result && typeof result === 'object' && 'success' in result && !result.success ? { isError: true } : {}),
  };
}
