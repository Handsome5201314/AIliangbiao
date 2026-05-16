import { NextRequest, NextResponse } from 'next/server';

import { analyzeCompletedAssessmentResult } from '@/lib/services/assessment-advice';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      deviceId,
      memberId,
      language,
      result,
    }: {
      deviceId?: string;
      memberId?: string;
      language?: 'zh' | 'en';
      result?: {
        scaleId: string;
        scaleName?: string;
        totalScore: number;
        conclusion: string;
        details?: {
          description?: string;
          [key: string]: unknown;
        };
      };
    } = body;

    if (!result || (!deviceId && !memberId)) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 });
    }

    const analyzed = await analyzeCompletedAssessmentResult({
      result,
      language,
      deviceId,
      profileId: memberId,
    });

    return NextResponse.json({
      success: true,
      advice: analyzed.advice,
      language: analyzed.language,
      generatedAt: analyzed.generatedAt,
      model: analyzed.model,
      provider: analyzed.provider,
    });
  } catch (error) {
    console.error('[Generate Advice Error]:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : '生成建议失败，请稍后重试' },
      { status: 500 }
    );
  }
}
