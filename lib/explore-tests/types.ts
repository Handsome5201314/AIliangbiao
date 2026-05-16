export type ExploreTestId = 'sbti';

export interface ExploreTestSource {
  siteUrl: string;
  author: string;
  disclaimer: string;
}

export interface ExploreTestDefinition {
  id: ExploreTestId;
  title: string;
  subtitle: string;
  description: string;
  routePath: string;
  questionCountLabel: string;
  dimensionCountLabel: string;
  resultCountLabel: string;
  tags: string[];
  source: ExploreTestSource;
}

export interface ExploreTestQuestionOption {
  label: string;
  value: number;
}

export interface ExploreTestQuestion {
  id: string;
  text: string;
  dim?: string;
  options: ExploreTestQuestionOption[];
  special?: boolean;
  kind?: string;
}

export interface ExploreTestDimensionMeta {
  name: string;
  model: string;
}

export interface ExploreTestTypeProfile {
  code: string;
  cn: string;
  intro: string;
  desc: string;
}

export interface ExploreTestRankedType extends ExploreTestTypeProfile {
  pattern: string;
  distance: number;
  exact: number;
  similarity: number;
}
