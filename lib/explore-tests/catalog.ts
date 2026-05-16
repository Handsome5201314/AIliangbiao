import type { ExploreTestDefinition } from './types';

export const EXPLORE_TESTS: ExploreTestDefinition[] = [
  {
    id: 'sbti',
    title: 'SBTI 人格测试',
    subtitle: 'MBTI 已经过时，SBTI 来了。',
    description:
      '网络流行的人格探索测试。当前公开版本基于 15 个维度、30 道主问题与 2 道酒类补充分支生成 27 种类型结果。',
    routePath: '/explore/sbti',
    questionCountLabel: '30 主题 + 2 分支',
    dimensionCountLabel: '15 维度',
    resultCountLabel: '27 类型',
    tags: ['热门', '非临床', '自我探索'],
    source: {
      siteUrl: 'https://sbti.unun.dev',
      author: 'B站 @蛆肉儿串儿',
      disclaimer:
        '本测试为网络流行的自我探索内容，不属于临床评估工具，仅供娱乐和自我观察参考。',
    },
  },
];

export function getExploreTestById(testId: string) {
  return EXPLORE_TESTS.find((item) => item.id === testId);
}
