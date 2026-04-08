import type { ExecutableScaleDefinition, ScaleDefinition, ScaleScoreResult } from "@/lib/schemas/core/types";
export declare function getAllScaleDefinitions(): ExecutableScaleDefinition[];
export declare function listSerializableScales(): ScaleDefinition[];
export declare function getScaleDefinitionById(scaleId: string): ExecutableScaleDefinition | undefined;
export declare function getSerializableScaleById(scaleId: string): ScaleDefinition | undefined;
export declare function evaluateScaleAnswers(scaleId: string, answers: number[]): ScaleScoreResult;
