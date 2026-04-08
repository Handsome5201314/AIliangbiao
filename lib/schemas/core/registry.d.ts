/**
 * 全局注册表：统一导出所有已激活的量表
 *
 * 新增量表时，只需在此数组的 import 后 push 即可
 */
import type { ExecutableScaleDefinition } from "./types";
/** 所有已激活的量表 */
export declare const AllScales: ExecutableScaleDefinition[];
