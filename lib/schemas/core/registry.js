"use strict";
/**
 * 全局注册表：统一导出所有已激活的量表
 *
 * 新增量表时，只需在此数组的 import 后 push 即可
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.AllScales = void 0;
const abc_1 = require("../autism/abc");
const cars_1 = require("../autism/cars");
const srs_1 = require("../autism/srs");
const snap_iv_1 = require("../adhd/snap-iv");
const mbti_1 = require("../MBTI/mbti");
const holland_1 = require("../career/holland");
/** 所有已激活的量表 */
exports.AllScales = [
    abc_1.ABC_Scale,
    cars_1.CARS_Scale,
    srs_1.SRS_Scale,
    snap_iv_1.SNAP_Scale,
    mbti_1.MBTI_Scale,
    holland_1.HOLLAND_Scale,
];
