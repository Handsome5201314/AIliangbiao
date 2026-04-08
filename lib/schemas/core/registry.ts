/**
 * 全局注册表：统一导出所有已激活的量表
 *
 * 新增量表时，只需在此数组的 import 后 push 即可
 */

import type { ExecutableScaleDefinition } from "./types";
import { ABC_Scale } from "../autism/abc";
import { CARS_Scale } from "../autism/cars";
import { SRS_Scale } from "../autism/srs";
import { SNAP_Scale } from "../adhd/snap-iv";
import { MBTI_Scale } from "../MBTI/mbti";
import { HOLLAND_Scale } from "../career/holland";

/** 所有已激活的量表 */
export const AllScales: ExecutableScaleDefinition[] = [
  ABC_Scale,
  CARS_Scale,
  SRS_Scale,
  SNAP_Scale,
  MBTI_Scale,
  HOLLAND_Scale,
];
