/**
 * 全局注册表：统一导出所有已激活的量表
 *
 * 新增量表时，只需在此数组的 import 后 push 即可
 */

import type { ExecutableScaleDefinition } from "./types";
import { ABC_Scale } from "../autism/abc";
import { ATEC_Scale } from "../autism/atec";
import { CARS_Scale } from "../autism/cars";
import { M_CHAT_R_Scale } from "../autism/m-chat-r";
import { SRS_Scale } from "../autism/srs";
import { SNAP_Scale } from "../adhd/snap-iv";
import { CBCL_Scale } from "../mental-health/cbcl";
import { TAS_37_Scale } from "../mental-health/test-anxiety-scale";
import { Vineland3_Scale } from "../development/vineland";

/** 所有已激活的量表 */
export const AllScales: ExecutableScaleDefinition[] = [
  ABC_Scale,
  ATEC_Scale,
  CARS_Scale,
  M_CHAT_R_Scale,
  SRS_Scale,
  SNAP_Scale,
  CBCL_Scale,
  TAS_37_Scale,
  Vineland3_Scale,
];
