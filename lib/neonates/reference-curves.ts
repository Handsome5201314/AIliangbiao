export type SexKey = 'boy' | 'girl';
export type MetricKey = 'length' | 'weight' | 'headCircumference';
export type PercentileKey = 'p3' | 'p10' | 'p25' | 'p50' | 'p75' | 'p90' | 'p97';

export type PercentilePoint = {
  week: number;
  p3: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p97: number;
};

export type PercentileAssessment = {
  bandLabel: string;
  zoneLabel: string;
  summaryLabel: string;
  approxPercentile: number | null;
};

type RawPercentileRow = readonly [number, number, number, number, number, number, number, number];

const MIN_REFERENCE_WEEK = 24;
const MAX_REFERENCE_WEEK = 42;

const identity = (value: number) => value;
const gramsToKilograms = (grams: number) => Number((grams / 1000).toFixed(3));

function createPercentilePoints(rows: readonly RawPercentileRow[], valueTransform: (value: number) => number = identity) {
  return rows.map(([week, p3, p10, p25, p50, p75, p90, p97]) => ({
    week,
    p3: valueTransform(p3),
    p10: valueTransform(p10),
    p25: valueTransform(p25),
    p50: valueTransform(p50),
    p75: valueTransform(p75),
    p90: valueTransform(p90),
    p97: valueTransform(p97),
  }));
}

const BOY_WEIGHT_ROWS: readonly RawPercentileRow[] = [
  [24, 455, 570, 655, 732, 804, 874, 959],
  [25, 513, 640, 734, 819, 900, 978, 1072],
  [26, 580, 719, 823, 918, 1008, 1096, 1200],
  [27, 657, 809, 924, 1030, 1130, 1228, 1343],
  [28, 745, 910, 1036, 1154, 1267, 1375, 1503],
  [29, 845, 1023, 1162, 1293, 1418, 1539, 1680],
  [30, 958, 1150, 1302, 1446, 1586, 1720, 1876],
  [31, 1087, 1292, 1457, 1617, 1771, 1920, 2091],
  [32, 1233, 1451, 1630, 1805, 1976, 2140, 2328],
  [33, 1400, 1628, 1820, 2012, 2199, 2380, 2585],
  [34, 1586, 1823, 2027, 2234, 2438, 2634, 2856],
  [35, 1791, 2033, 2247, 2467, 2686, 2897, 3133],
  [36, 2015, 2258, 2477, 2707, 2937, 3159, 3406],
  [37, 2247, 2487, 2708, 2943, 3181, 3410, 3664],
  [38, 2468, 2701, 2921, 3157, 3399, 3632, 3889],
  [39, 2649, 2874, 3091, 3329, 3573, 3809, 4068],
  [40, 2783, 3002, 3216, 3455, 3702, 3941, 4203],
  [41, 2886, 3100, 3314, 3554, 3806, 4051, 4319],
  [42, 2977, 3188, 3402, 3647, 3907, 4161, 4438],
];

const GIRL_WEIGHT_ROWS: readonly RawPercentileRow[] = [
  [24, 416, 498, 564, 629, 692, 756, 833],
  [25, 479, 572, 648, 722, 796, 869, 958],
  [26, 549, 654, 741, 826, 911, 995, 1096],
  [27, 626, 745, 843, 941, 1038, 1135, 1250],
  [28, 711, 844, 955, 1067, 1178, 1288, 1418],
  [29, 804, 951, 1076, 1203, 1330, 1455, 1601],
  [30, 906, 1068, 1209, 1352, 1495, 1636, 1800],
  [31, 1020, 1198, 1354, 1515, 1676, 1835, 2018],
  [32, 1151, 1344, 1516, 1694, 1875, 2051, 2254],
  [33, 1302, 1509, 1696, 1892, 2091, 2285, 2506],
  [34, 1477, 1695, 1896, 2108, 2323, 2534, 2771],
  [35, 1676, 1902, 2113, 2338, 2568, 2791, 3042],
  [36, 1896, 2125, 2342, 2575, 2815, 3047, 3305],
  [37, 2130, 2357, 2574, 2810, 3052, 3287, 3546],
  [38, 2358, 2579, 2792, 3026, 3266, 3498, 3753],
  [39, 2547, 2762, 2971, 3202, 3440, 3670, 3920],
  [40, 2686, 2896, 3104, 3336, 3575, 3806, 4055],
  [41, 2796, 3005, 3214, 3448, 3691, 3925, 4178],
  [42, 2891, 3101, 3312, 3551, 3801, 4042, 4301],
];

const BOY_LENGTH_ROWS: readonly RawPercentileRow[] = [
  [24, 26.9, 28.3, 29.7, 31.2, 32.6, 33.8, 35.0],
  [25, 28.1, 29.6, 31.0, 32.5, 34.0, 35.3, 36.5],
  [26, 29.2, 30.8, 32.3, 33.9, 35.4, 36.7, 38.0],
  [27, 30.5, 32.1, 33.7, 35.3, 36.9, 38.3, 39.6],
  [28, 31.7, 33.4, 35.1, 36.8, 38.4, 39.8, 41.2],
  [29, 33.0, 34.8, 36.5, 38.2, 39.9, 41.3, 42.7],
  [30, 34.3, 36.2, 37.9, 39.7, 41.4, 42.8, 44.2],
  [31, 35.7, 37.7, 39.4, 41.2, 42.8, 44.3, 45.6],
  [32, 37.2, 39.1, 40.9, 42.6, 44.3, 45.6, 47.0],
  [33, 38.7, 40.7, 42.4, 44.1, 45.6, 46.9, 48.3],
  [34, 40.2, 42.2, 43.8, 45.4, 46.8, 48.2, 49.5],
  [35, 41.8, 43.6, 45.2, 46.6, 48.0, 49.2, 50.7],
  [36, 43.2, 45.0, 46.4, 47.7, 49.0, 50.4, 51.8],
  [37, 44.4, 46.2, 47.5, 48.7, 49.8, 51.2, 52.9],
  [38, 45.6, 47.3, 48.5, 49.5, 50.6, 52.1, 53.7],
  [39, 46.5, 48.2, 49.3, 50.3, 51.2, 52.6, 54.4],
  [40, 47.3, 48.9, 49.8, 50.8, 51.7, 53.1, 54.9],
  [41, 47.9, 49.4, 50.2, 51.2, 52.1, 53.5, 55.3],
  [42, 48.3, 49.7, 50.5, 51.4, 52.4, 53.8, 55.6],
];

const GIRL_LENGTH_ROWS: readonly RawPercentileRow[] = [
  [24, 26.9, 28.2, 29.4, 30.6, 31.8, 32.8, 33.7],
  [25, 28.0, 29.4, 30.6, 32.0, 33.2, 34.2, 35.2],
  [26, 29.1, 30.6, 31.9, 33.3, 34.7, 35.8, 36.8],
  [27, 30.2, 31.8, 33.2, 34.7, 36.2, 37.4, 38.5],
  [28, 31.4, 33.0, 34.6, 36.2, 37.7, 39.0, 40.2],
  [29, 32.5, 34.3, 35.9, 37.6, 39.2, 40.5, 41.8],
  [30, 33.8, 35.6, 37.3, 39.0, 40.7, 42.1, 43.4],
  [31, 35.1, 36.9, 38.6, 40.4, 42.1, 43.5, 44.9],
  [32, 36.4, 38.3, 40.0, 41.8, 43.5, 44.9, 46.3],
  [33, 37.8, 39.7, 41.4, 43.2, 44.9, 46.3, 47.6],
  [34, 39.3, 41.2, 42.9, 44.6, 46.2, 47.5, 48.7],
  [35, 40.8, 42.7, 44.3, 45.9, 47.4, 48.6, 50.0],
  [36, 42.4, 44.1, 45.7, 47.1, 48.5, 49.6, 50.9],
  [37, 43.7, 45.3, 46.9, 48.2, 49.4, 50.4, 51.9],
  [38, 44.8, 46.4, 47.9, 49.1, 50.1, 51.1, 52.6],
  [39, 45.8, 47.3, 48.7, 49.9, 50.7, 51.7, 53.2],
  [40, 46.5, 48.1, 49.4, 50.4, 51.3, 52.3, 53.7],
  [41, 47.1, 48.7, 49.8, 50.9, 51.7, 52.6, 54.2],
  [42, 47.6, 49.2, 50.1, 51.2, 52.0, 53.0, 54.5],
];

const BOY_HEAD_ROWS: readonly RawPercentileRow[] = [
  [24, 19.4, 20.3, 21.2, 22.0, 22.8, 23.5, 24.0],
  [25, 20.3, 21.3, 22.2, 23.1, 23.9, 24.6, 25.2],
  [26, 21.2, 22.3, 23.2, 24.1, 25.0, 25.7, 26.4],
  [27, 22.1, 23.2, 24.1, 25.1, 26.0, 26.8, 27.5],
  [28, 23.0, 24.1, 25.1, 26.1, 27.0, 27.8, 28.6],
  [29, 23.9, 25.0, 26.0, 27.0, 28.0, 28.9, 29.7],
  [30, 24.7, 25.8, 26.9, 28.0, 29.0, 29.9, 30.7],
  [31, 25.6, 26.7, 27.7, 28.8, 29.9, 30.8, 31.7],
  [32, 26.4, 27.5, 28.6, 29.7, 30.7, 31.7, 32.6],
  [33, 27.3, 28.4, 29.4, 30.5, 31.5, 32.5, 33.4],
  [34, 28.1, 29.2, 30.2, 31.3, 32.3, 33.2, 34.2],
  [35, 28.9, 30.0, 30.9, 31.9, 32.9, 33.9, 34.8],
  [36, 29.7, 30.6, 31.6, 32.5, 33.5, 34.4, 35.3],
  [37, 30.3, 31.2, 32.1, 33.1, 34.0, 34.9, 35.8],
  [38, 30.9, 31.8, 32.6, 33.5, 34.4, 35.3, 36.1],
  [39, 31.3, 32.2, 33.0, 33.9, 34.7, 35.6, 36.5],
  [40, 31.6, 32.5, 33.3, 34.1, 35.0, 35.8, 36.7],
  [41, 31.9, 32.8, 33.6, 34.4, 35.2, 36.0, 36.9],
  [42, 32.2, 33.0, 33.8, 34.6, 35.4, 36.2, 37.1],
];

const GIRL_HEAD_ROWS: readonly RawPercentileRow[] = [
  [24, 19.3, 20.0, 20.7, 21.6, 22.3, 22.8, 23.2],
  [25, 20.1, 20.9, 21.7, 22.6, 23.3, 23.9, 24.4],
  [26, 20.9, 21.8, 22.6, 23.6, 24.4, 25.0, 25.6],
  [27, 21.7, 22.7, 23.6, 24.5, 25.4, 26.1, 26.7],
  [28, 22.6, 23.5, 24.5, 25.5, 26.5, 27.2, 27.9],
  [29, 23.4, 24.4, 25.4, 26.5, 27.5, 28.3, 29.0],
  [30, 24.2, 25.2, 26.3, 27.4, 28.5, 29.3, 30.1],
  [31, 25.0, 26.1, 27.2, 28.3, 29.4, 30.3, 31.1],
  [32, 25.9, 27.0, 28.1, 29.2, 30.3, 31.2, 32.1],
  [33, 26.8, 27.9, 28.9, 30.1, 31.1, 32.1, 33.0],
  [34, 27.7, 28.7, 29.7, 30.8, 31.9, 32.8, 33.7],
  [35, 28.5, 29.5, 30.5, 31.5, 32.6, 33.5, 34.4],
  [36, 29.3, 30.2, 31.2, 32.2, 33.1, 34.0, 34.9],
  [37, 30.0, 30.9, 31.8, 32.7, 33.6, 34.5, 35.3],
  [38, 30.5, 31.4, 32.3, 33.1, 34.0, 34.8, 35.7],
  [39, 31.0, 31.9, 32.7, 33.5, 34.3, 35.2, 36.0],
  [40, 31.4, 32.2, 33.0, 33.8, 34.6, 35.4, 36.3],
  [41, 31.7, 32.5, 33.3, 34.1, 34.9, 35.7, 36.6],
  [42, 31.9, 32.8, 33.6, 34.3, 35.2, 36.0, 36.9],
];

export const REFERENCE_CURVES: Record<SexKey, Record<MetricKey, PercentilePoint[]>> = {
  boy: {
    weight: createPercentilePoints(BOY_WEIGHT_ROWS, gramsToKilograms),
    length: createPercentilePoints(BOY_LENGTH_ROWS),
    headCircumference: createPercentilePoints(BOY_HEAD_ROWS),
  },
  girl: {
    weight: createPercentilePoints(GIRL_WEIGHT_ROWS, gramsToKilograms),
    length: createPercentilePoints(GIRL_LENGTH_ROWS),
    headCircumference: createPercentilePoints(GIRL_HEAD_ROWS),
  },
};

function interpolatePercentile(
  value: number,
  lowerValue: number,
  upperValue: number,
  lowerPercentile: number,
  upperPercentile: number,
) {
  if (upperValue === lowerValue) {
    return upperPercentile;
  }

  return lowerPercentile + ((value - lowerValue) / (upperValue - lowerValue)) * (upperPercentile - lowerPercentile);
}

function clampReferenceWeek(week: number) {
  return Math.min(MAX_REFERENCE_WEEK, Math.max(MIN_REFERENCE_WEEK, week));
}

export function evaluateAgainstPercentiles(value: number, point: PercentilePoint): PercentileAssessment {
  if (value < point.p3) {
    return {
      bandLabel: '低于 P3',
      zoneLabel: '偏低需关注',
      summaryLabel: '低于 P3 偏低区间',
      approxPercentile: null,
    };
  }

  if (value <= point.p10) {
    return {
      bandLabel: 'P3 - P10',
      zoneLabel: '偏低关注区间',
      summaryLabel: 'P3 - P10 偏低关注区间',
      approxPercentile: interpolatePercentile(value, point.p3, point.p10, 3, 10),
    };
  }

  if (value <= point.p25) {
    return {
      bandLabel: 'P10 - P25',
      zoneLabel: '正常区间',
      summaryLabel: 'P10 - P25 正常区间',
      approxPercentile: interpolatePercentile(value, point.p10, point.p25, 10, 25),
    };
  }

  if (value <= point.p50) {
    return {
      bandLabel: 'P25 - P50',
      zoneLabel: '正常区间',
      summaryLabel: 'P25 - P50 正常区间',
      approxPercentile: interpolatePercentile(value, point.p25, point.p50, 25, 50),
    };
  }

  if (value <= point.p75) {
    return {
      bandLabel: 'P50 - P75',
      zoneLabel: '正常区间',
      summaryLabel: 'P50 - P75 正常区间',
      approxPercentile: interpolatePercentile(value, point.p50, point.p75, 50, 75),
    };
  }

  if (value <= point.p90) {
    return {
      bandLabel: 'P75 - P90',
      zoneLabel: '正常区间',
      summaryLabel: 'P75 - P90 正常区间',
      approxPercentile: interpolatePercentile(value, point.p75, point.p90, 75, 90),
    };
  }

  if (value <= point.p97) {
    return {
      bandLabel: 'P90 - P97',
      zoneLabel: '偏高关注区间',
      summaryLabel: 'P90 - P97 偏高关注区间',
      approxPercentile: interpolatePercentile(value, point.p90, point.p97, 90, 97),
    };
  }

  return {
    bandLabel: '高于 P97',
    zoneLabel: '偏高需评估',
    summaryLabel: '高于 P97 偏高区间',
    approxPercentile: null,
  };
}

export function getReferenceLookupWeek(weeks: number, days = 0) {
  const normalizedDays = Math.max(0, Math.round(weeks * 7 + days));
  const wholeWeeks = Math.floor(normalizedDays / 7);
  const remainingDays = normalizedDays % 7;
  return clampReferenceWeek(wholeWeeks + (remainingDays >= 6 ? 1 : 0));
}

export function getReferencePoint(sex: SexKey, metric: MetricKey, lookupWeek: number) {
  const safeWeek = clampReferenceWeek(Math.round(lookupWeek));
  const points = REFERENCE_CURVES[sex][metric];
  return points.find((point) => point.week === safeWeek) ?? points[0];
}

export function getReferencePointForGestation(sex: SexKey, metric: MetricKey, weeks: number, days = 0) {
  const lookupWeek = getReferenceLookupWeek(weeks, days);
  return {
    lookupWeek,
    point: getReferencePoint(sex, metric, lookupWeek),
  };
}

export function gestationToDecimal(weeks: number, days: number) {
  return weeks + days / 7;
}

export function formatGestationLabel(weeks: number, days: number) {
  return `${weeks}周${days}天`;
}

export function formatReferenceLookupLabel(lookupWeek: number) {
  return `按 ${lookupWeek} 周查表`;
}

export function formatGestationTick(value: number) {
  const safeValue = Number.isFinite(value) ? value : 0;
  let weeks = Math.floor(safeValue);
  let days = Math.round((safeValue - weeks) * 7);

  if (days >= 7) {
    weeks += 1;
    days = 0;
  }

  return `${weeks}+${days}`;
}
