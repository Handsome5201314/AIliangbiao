'use client';

import { useEffect, useMemo, useState } from 'react';
import { ArrowLeft, Copy, ExternalLink, RefreshCcw, Share2, Sparkles } from 'lucide-react';

import {
  type SbtiQuestion,
  type SbtiResult,
  SBTI_DIMENSION_META,
  SBTI_DRUNK_TRIGGER_QUESTION_ID,
  SBTI_SOURCE,
  SBTI_STORAGE_KEYS,
  buildSbtiQuestionDeck,
  computeSbtiResult,
  getVisibleSbtiQuestions,
  isSbtiQuestionDeckComplete,
  sanitizeSbtiAnswers,
} from '@/lib/explore-tests/sbti';

type SbtiScreen = 'intro' | 'test' | 'result';

type StoredSbtiSession = {
  questionDeck: SbtiQuestion[];
  answers: Record<string, number>;
};

function readStoredSession() {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(SBTI_STORAGE_KEYS.session);
    return raw ? (JSON.parse(raw) as StoredSbtiSession) : null;
  } catch (error) {
    return null;
  }
}

function readStoredResult() {
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(SBTI_STORAGE_KEYS.result);
    return raw ? (JSON.parse(raw) as SbtiResult) : null;
  } catch (error) {
    return null;
  }
}

function persistSession(session: StoredSbtiSession | null) {
  if (typeof window === 'undefined') return;

  if (!session) {
    localStorage.removeItem(SBTI_STORAGE_KEYS.session);
    return;
  }

  localStorage.setItem(SBTI_STORAGE_KEYS.session, JSON.stringify(session));
}

function persistResult(result: SbtiResult | null) {
  if (typeof window === 'undefined') return;

  if (!result) {
    localStorage.removeItem(SBTI_STORAGE_KEYS.result);
    return;
  }

  localStorage.setItem(SBTI_STORAGE_KEYS.result, JSON.stringify(result));
}

export default function SBTIPage() {
  const [screen, setScreen] = useState<SbtiScreen>('intro');
  const [questionDeck, setQuestionDeck] = useState<SbtiQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, number>>({});
  const [result, setResult] = useState<SbtiResult | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const storedSession = readStoredSession();
    const storedResult = readStoredResult();

    if (storedResult) {
      setResult(storedResult);
      setScreen('result');
    }

    if (storedSession?.questionDeck?.length) {
      setQuestionDeck(storedSession.questionDeck);
      setAnswers(storedSession.answers || {});
      if (!storedResult) {
        setScreen('test');
      }
    }
  }, []);

  const visibleQuestions = useMemo(
    () => getVisibleSbtiQuestions(questionDeck, answers),
    [answers, questionDeck]
  );
  const answeredCount = visibleQuestions.filter((item) => answers[item.id] !== undefined).length;
  const isComplete = questionDeck.length > 0 && isSbtiQuestionDeckComplete(questionDeck, answers);

  const startTest = () => {
    const nextDeck = buildSbtiQuestionDeck();
    const nextAnswers = {};
    setQuestionDeck(nextDeck);
    setAnswers(nextAnswers);
    setResult(null);
    setScreen('test');
    persistSession({ questionDeck: nextDeck, answers: nextAnswers });
    persistResult(null);
  };

  const handleAnswerChange = (questionId: string, value: number) => {
    setAnswers((current) => {
      const next = {
        ...current,
        [questionId]: value,
      };

      const visible = getVisibleSbtiQuestions(questionDeck, next);
      const sanitized = sanitizeSbtiAnswers(next, visible);
      persistSession({ questionDeck, answers: sanitized });
      return sanitized;
    });
  };

  const handleSubmit = () => {
    const nextResult = computeSbtiResult(answers);
    setResult(nextResult);
    setScreen('result');
    persistResult(nextResult);
  };

  const handleRestart = () => {
    startTest();
  };

  const handleCopy = async () => {
    if (!result) return;

    const payload = [
      `SBTI 结果：${result.finalType.code}（${result.finalType.cn}）`,
      result.finalType.intro,
      result.badge,
      result.sub,
      '',
      `来源：${SBTI_SOURCE.siteUrl}`,
      `原作者：${SBTI_SOURCE.author}`,
      `说明：${SBTI_SOURCE.disclaimer}`,
    ].join('\n');

    await navigator.clipboard.writeText(payload);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 2000);
  };

  const handleShare = async () => {
    if (!result || !navigator.share) return;

    await navigator.share({
      title: `我的 SBTI 结果：${result.finalType.code}（${result.finalType.cn}）`,
      text: `${result.finalType.intro}\n${result.badge}`,
      url: window.location.href,
    });
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#f8fff8_0,_#f6faf6_36%,_#f2f7f3_100%)] px-4 py-8 text-slate-900">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 flex items-center justify-between gap-4">
          <a
            href="/?section=explore"
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition-colors hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>返回探索测试</span>
          </a>
          <a
            href={SBTI_SOURCE.siteUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-700 transition-colors hover:bg-emerald-100"
          >
            <ExternalLink className="h-4 w-4" />
            <span>查看原站</span>
          </a>
        </div>

        {screen === 'intro' && (
          <div className="rounded-[28px] border border-slate-200 bg-white px-6 py-8 shadow-[0_18px_45px_rgba(47,73,55,0.08)] md:px-10 md:py-12">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-800">
              <Sparkles className="h-3.5 w-3.5" />
              <span>探索测试 · 非临床工具</span>
            </div>
            <h1 className="mt-5 text-4xl font-black tracking-tight text-slate-900 md:text-6xl">
              MBTI 已经过时，SBTI 来了。
            </h1>
            <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-500 md:text-base">
              这是一个网络流行的自我探索测试。站内版本根据公开前端脚本复刻，包含 15 个维度、30 道主问题与 2 道饮酒分支题，
              用于生成 27 种娱乐化人格结果。
            </p>

            <div className="mt-8 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <h2 className="text-lg font-semibold text-slate-900">使用说明</h2>
                <ul className="mt-3 space-y-2 text-sm leading-7 text-slate-600">
                  <li>本测试仅供娱乐与自我探索，不属于临床评估工具。</li>
                  <li>站内实现与专业量表链路完全隔离，不写入专业测评历史。</li>
                  <li>答题进度和结果仅保存在当前浏览器的本地存储中。</li>
                </ul>
              </div>
              <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
                <h2 className="text-lg font-semibold text-slate-900">来源</h2>
                <div className="mt-3 space-y-2 text-sm text-slate-600">
                  <p>来源站点：{SBTI_SOURCE.siteUrl}</p>
                  <p>原作者：{SBTI_SOURCE.author}</p>
                  <p>提示：站内版本保留玩法结构，但不代表专业测评结论。</p>
                </div>
              </div>
            </div>

            <div className="mt-8 flex flex-wrap gap-3">
              <button
                type="button"
                onClick={startTest}
                className="rounded-2xl bg-emerald-700 px-6 py-3 text-base font-bold text-white shadow-[0_12px_30px_rgba(77,106,83,0.18)] transition-all hover:-translate-y-0.5 hover:bg-emerald-800"
              >
                开始测试
              </button>
              <a
                href={SBTI_SOURCE.siteUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl border border-slate-200 bg-white px-6 py-3 text-base font-bold text-slate-700 transition-colors hover:bg-slate-50"
              >
                查看原站
              </a>
            </div>
          </div>
        )}

        {screen === 'test' && (
          <div className="rounded-[28px] border border-slate-200 bg-white px-5 py-6 shadow-[0_18px_45px_rgba(47,73,55,0.08)] md:px-8">
            <div className="mb-6 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-300 to-emerald-700 transition-all"
                  style={{ width: `${visibleQuestions.length ? (answeredCount / visibleQuestions.length) * 100 : 0}%` }}
                />
              </div>
              <div className="text-sm text-slate-500">
                已完成 {answeredCount} / {visibleQuestions.length}
              </div>
            </div>

            <div className="space-y-4">
              {visibleQuestions.map((question, index) => (
                <div key={question.id} className="rounded-3xl border border-slate-200 bg-[linear-gradient(180deg,#ffffff,#fbfdfb)] p-5">
                  <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 font-semibold">
                      {question.special ? '补充题' : '维度已隐藏'}
                    </span>
                    <span>第 {index + 1} 题</span>
                  </div>
                  <h2 className="text-base font-semibold leading-7 text-slate-900">{question.text}</h2>

                  <div className="mt-4 space-y-3">
                    {question.options.map((option) => (
                      <label
                        key={`${question.id}-${option.value}`}
                        className={`flex cursor-pointer items-start gap-3 rounded-2xl border px-4 py-3 transition-colors ${
                          answers[question.id] === option.value
                            ? 'border-emerald-300 bg-emerald-50'
                            : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                        }`}
                      >
                        <input
                          type="radio"
                          name={question.id}
                          value={option.value}
                          checked={answers[question.id] === option.value}
                          onChange={() => handleAnswerChange(question.id, option.value)}
                          className="mt-1 h-4 w-4 accent-emerald-700"
                        />
                        <span className="text-sm leading-7 text-slate-700">{option.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
              <p className="text-sm leading-7 text-slate-500">
                本测试仅供娱乐。未答完前不会显示结果；刷新页面会继续保留当前浏览器中的答题进度。
              </p>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  onClick={() => setScreen('intro')}
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                >
                  返回介绍
                </button>
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!isComplete}
                  className="rounded-2xl bg-emerald-700 px-5 py-3 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  查看结果
                </button>
              </div>
            </div>
          </div>
        )}

        {screen === 'result' && result && (
          <div className="space-y-6">
            <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(47,73,55,0.08)] md:p-8">
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-700">
                  {result.modeKicker}
                </p>
                <h1 className="mt-3 text-3xl font-black tracking-tight text-slate-900 md:text-5xl">
                  {result.finalType.code}（{result.finalType.cn}）
                </h1>
                <p className="mt-3 text-lg text-slate-500">{result.finalType.intro}</p>
                <div className="mt-5 inline-flex rounded-full border border-slate-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800">
                  {result.badge}
                </div>
                <p className="mt-5 text-sm leading-7 text-slate-600">{result.sub}</p>
                <p className="mt-6 text-sm leading-8 text-slate-700">{result.finalType.desc}</p>

                {result.secondaryType && (
                  <div className="mt-6 rounded-3xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                    隐藏人格激活前的常规匹配类型：{result.secondaryType.code}（{result.secondaryType.cn}）
                  </div>
                )}
              </section>

              <section className="space-y-6">
                <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(47,73,55,0.08)]">
                  <h2 className="text-lg font-semibold text-slate-900">Top 3 最突出维度</h2>
                  <div className="mt-4 space-y-3">
                    {result.topDimensions.map((item) => (
                      <div key={item.dim} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="font-semibold text-slate-900">{item.name}</p>
                            <p className="text-xs text-slate-500">{item.model}</p>
                          </div>
                          <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-emerald-700">
                            {item.level} / {item.rawScore}分
                          </span>
                        </div>
                        <p className="mt-3 text-sm leading-7 text-slate-600">{item.explanation}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(47,73,55,0.08)]">
                  <h2 className="text-lg font-semibold text-slate-900">操作</h2>
                  <div className="mt-4 flex flex-wrap gap-3">
                    <button
                      type="button"
                      onClick={handleRestart}
                      className="inline-flex items-center gap-2 rounded-full bg-emerald-700 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-800"
                    >
                      <RefreshCcw className="h-4 w-4" />
                      <span>再次测试</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleCopy()}
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <Copy className="h-4 w-4" />
                      <span>{copied ? '已复制' : '复制结果'}</span>
                    </button>
                    {typeof navigator !== 'undefined' && typeof navigator.share === 'function' && (
                      <button
                        type="button"
                        onClick={() => void handleShare()}
                        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                      >
                        <Share2 className="h-4 w-4" />
                        <span>分享结果</span>
                      </button>
                    )}
                    <a
                      href={SBTI_SOURCE.siteUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      <ExternalLink className="h-4 w-4" />
                      <span>查看原站</span>
                    </a>
                  </div>
                </div>
              </section>
            </div>

            <section className="rounded-[28px] border border-slate-200 bg-white p-6 shadow-[0_18px_45px_rgba(47,73,55,0.08)]">
              <h2 className="text-lg font-semibold text-slate-900">15 维度明细</h2>
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {Object.keys(SBTI_DIMENSION_META).map((dimension) => (
                  <div key={dimension} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-semibold text-slate-900">{SBTI_DIMENSION_META[dimension].name}</p>
                        <p className="text-xs text-slate-500">{SBTI_DIMENSION_META[dimension].model}</p>
                      </div>
                      <span className="rounded-full bg-white px-3 py-1 text-xs font-bold text-emerald-700">
                        {result.levels[dimension]} / {result.rawScores[dimension]}分
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-[28px] border border-amber-200 bg-amber-50 p-6 text-sm leading-7 text-amber-900 shadow-[0_18px_45px_rgba(47,73,55,0.08)]">
              <p className="font-semibold">来源与免责声明</p>
              <p className="mt-2">来源站点：{SBTI_SOURCE.siteUrl}</p>
              <p>原作者：{SBTI_SOURCE.author}</p>
              <p className="mt-3">{SBTI_SOURCE.disclaimer}</p>
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
