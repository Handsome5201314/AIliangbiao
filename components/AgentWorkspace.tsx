'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bot, Brain, ChevronRight, Loader2, MessageSquareMore, ShieldCheck, UserRound } from 'lucide-react';

import { useProfile } from '@/contexts/ProfileContext';
import type { TriageContext } from '@/lib/services/triageFlow';

type AgentMessage = {
  role: 'user' | 'assistant';
  content: string;
};

type AgentSessionResponse = {
  token: string;
  member: {
    id: string;
    nickname: string;
    relation: string;
  };
};

type SkillMember = {
  id: string;
  nickname: string;
  relation: string;
  languagePreference: string;
  ageMonths: number | null;
  interests: string[];
  fears: string[];
};

export default function AgentWorkspace() {
  const router = useRouter();
  const { profile, profiles, activeProfileId, selectProfile } = useProfile();

  const [token, setToken] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [members, setMembers] = useState<SkillMember[]>([]);
  const [memorySummary, setMemorySummary] = useState<any>(null);
  const [assessmentSummary, setAssessmentSummary] = useState<any>(null);
  const [messages, setMessages] = useState<AgentMessage[]>([]);
  const [input, setInput] = useState('');
  const [recommendedScale, setRecommendedScale] = useState<string>('');
  const [error, setError] = useState('');
  const [triageContext, setTriageContext] = useState<TriageContext>({
    state: 'initial',
    symptoms: [],
    conversationHistory: [],
    consentGiven: false,
    language: profile.languagePreference || 'zh',
  });

  const getDeviceId = useCallback(() => {
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      localStorage.setItem('device_id', deviceId);
    }
    return deviceId;
  }, []);

  const bootstrapAgent = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const deviceId = getDeviceId();
      const sessionResponse = await fetch('/api/agent/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          memberId: activeProfileId,
          memberSnapshot: {
            nickname: profile.nickname,
            gender: profile.gender,
            ageMonths: profile.ageMonths,
            relation: profile.relation,
            languagePreference: profile.languagePreference,
            interests: profile.interests,
            fears: profile.fears,
            avatarConfig: profile.avatarState,
          },
        }),
      });

      if (!sessionResponse.ok) {
        const errorData = await sessionResponse.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create agent session');
      }

      const sessionData = await sessionResponse.json() as AgentSessionResponse;
      setToken(sessionData.token);

      const headers = { Authorization: `Bearer ${sessionData.token}` };
      const [membersResponse, memoryResponse, assessmentResponse] = await Promise.all([
        fetch('/api/skill/v1/me/members', { headers }),
        fetch(`/api/skill/v1/me/members/${sessionData.member.id}/memory-summary`, { headers }),
        fetch(`/api/skill/v1/me/members/${sessionData.member.id}/assessment-summary`, { headers }),
      ]);

      const membersPayload = await membersResponse.json();
      const memoryPayload = await memoryResponse.json();
      const assessmentPayload = await assessmentResponse.json();

      setMembers(membersPayload.members || []);
      setMemorySummary(memoryPayload);
      setAssessmentSummary(assessmentPayload);
      setMessages([
        {
          role: 'assistant',
          content:
            profile.languagePreference === 'en'
              ? `Agent session is ready for ${sessionData.member.nickname}. Tell me what you want to assess, and I will recommend the right scale.`
              : `已为 ${sessionData.member.nickname} 建立智能体会话。你可以直接告诉我想评估什么，我会推荐合适的量表。`,
        },
      ]);
      setTriageContext((prev) => ({
        ...prev,
        language: profile.languagePreference || 'zh',
      }));
    } catch (bootstrapError) {
      setError(bootstrapError instanceof Error ? bootstrapError.message : 'Failed to bootstrap agent');
    } finally {
      setLoading(false);
    }
  }, [
    activeProfileId,
    getDeviceId,
    profile.ageMonths,
    profile.avatarState,
    profile.fears,
    profile.gender,
    profile.interests,
    profile.languagePreference,
    profile.nickname,
    profile.relation,
  ]);

  useEffect(() => {
    void bootstrapAgent();
  }, [bootstrapAgent]);

  const sendMessage = useCallback(async () => {
    if (!token || !input.trim() || sending) {
      return;
    }

    const content = input.trim();
    setInput('');
    setSending(true);
    setMessages((prev) => [...prev, { role: 'user', content }]);

    try {
      const response = await fetch('/api/skill/v1/voice-intent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          mode: 'triage',
          language: profile.languagePreference || 'zh',
          transcript: content,
          triageContext,
          userProfile: {
            nickname: profile.nickname,
            ageMonths: profile.ageMonths,
            relation: profile.relation,
          },
        }),
      });

      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error || 'Agent failed to respond');
      }

      const result = payload.result;
      setMessages((prev) => [...prev, { role: 'assistant', content: result.text }]);
      setRecommendedScale(result.scaleId || '');
      setTriageContext((prev) => ({
        ...prev,
        state:
          result.action === 'recommend_scale'
            ? 'consent'
            : result.action === 'start_scale'
              ? 'handoff'
              : result.action === 'pause_session'
                ? 'paused'
                : result.action === 'resume_session'
                  ? 'triage'
                  : prev.state === 'initial'
                    ? 'triage'
                    : prev.state,
        symptoms: result.symptoms || prev.symptoms,
        recommendedScale: result.scaleId || prev.recommendedScale,
        conversationHistory: [
          ...prev.conversationHistory,
          { role: 'user', content, timestamp: Date.now() },
          { role: 'assistant', content: result.text, timestamp: Date.now() },
        ],
      }));
    } catch (sendError) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: sendError instanceof Error ? sendError.message : 'Agent failed to respond.',
        },
      ]);
    } finally {
      setSending(false);
    }
  }, [input, profile.ageMonths, profile.languagePreference, profile.nickname, profile.relation, sending, token, triageContext]);

  const currentMemoryNotes = memorySummary?.agentNotes || [];
  const recentAssessments = assessmentSummary?.items || [];

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,#dbeafe,transparent_38%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)]">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="mb-8 flex items-start justify-between gap-6">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-white px-3 py-1 text-xs font-semibold uppercase tracking-[0.24em] text-indigo-700">
              <Bot className="h-3.5 w-3.5" />
              <span>Agent</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-900">OpenClaw-Ready Agent Workspace</h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-600">
              这个页面作为 `/agent` 的前台入口，只通过受控 skill 读取当前用户与当前成员的数据，不直接访问数据库。
            </p>
          </div>
          <button
            type="button"
            onClick={() => router.push('/')}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
          >
            返回主站
          </button>
        </div>

        {error && (
          <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[320px,1fr]">
          <aside className="space-y-4">
            <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-slate-800">
                <UserRound className="h-4 w-4 text-indigo-600" />
                <span className="text-sm font-semibold">当前成员</span>
              </div>
              <select
                value={activeProfileId}
                onChange={(event) => selectProfile(event.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-800 outline-none"
              >
                {profiles.map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.nickname}
                  </option>
                ))}
              </select>
              <p className="mt-3 text-xs text-slate-500">
                当前 skill token 只绑定当前成员，切换成员会重新签发 token。
              </p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-slate-800">
                <ShieldCheck className="h-4 w-4 text-emerald-600" />
                <span className="text-sm font-semibold">隔离边界</span>
              </div>
              <ul className="space-y-2 text-sm text-slate-600">
                <li>OpenClaw 不直接访问数据库</li>
                <li>只能读取当前用户的当前成员信息</li>
                <li>长期记忆存储在核心 skill 平台</li>
              </ul>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-slate-800">
                <Brain className="h-4 w-4 text-indigo-600" />
                <span className="text-sm font-semibold">长期记忆摘要</span>
              </div>
              {loading ? (
                <div className="text-sm text-slate-400">加载中...</div>
              ) : (
                <div className="space-y-3 text-sm text-slate-600">
                  <div>
                    <div className="font-medium text-slate-800">兴趣</div>
                    <div>{(memorySummary?.interests || []).join('、') || '暂无'}</div>
                  </div>
                  <div>
                    <div className="font-medium text-slate-800">担忧/恐惧</div>
                    <div>{(memorySummary?.fears || []).join('、') || '暂无'}</div>
                  </div>
                  <div>
                    <div className="font-medium text-slate-800">Agent Notes</div>
                    <div>{currentMemoryNotes.length ? currentMemoryNotes.length : '暂无'}</div>
                  </div>
                </div>
              )}
            </div>

            <div className="rounded-3xl border border-slate-200 bg-white/90 p-5 shadow-sm">
              <div className="mb-3 flex items-center gap-2 text-slate-800">
                <MessageSquareMore className="h-4 w-4 text-indigo-600" />
                <span className="text-sm font-semibold">评测摘要</span>
              </div>
              {loading ? (
                <div className="text-sm text-slate-400">加载中...</div>
              ) : recentAssessments.length ? (
                <div className="space-y-3">
                  {recentAssessments.slice(0, 3).map((item: any) => (
                    <div key={item.id} className="rounded-2xl bg-slate-50 px-3 py-2 text-sm text-slate-600">
                      <div className="font-medium text-slate-800">{item.scaleId}</div>
                      <div>{item.conclusion}</div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-slate-400">暂无历史评测</div>
              )}
            </div>
          </aside>

          <section className="rounded-[2rem] border border-slate-200 bg-white/90 p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <h2 className="text-xl font-bold text-slate-900">Agent Conversation</h2>
                <p className="text-sm text-slate-500">V1 负责推荐、分诊、解释和导流，正式答题仍回到现有问卷页。</p>
              </div>
              {recommendedScale && (
                <button
                  type="button"
                  onClick={() => router.push(`/?scaleId=${encodeURIComponent(recommendedScale)}`)}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-600"
                >
                  <span>开始 {recommendedScale}</span>
                  <ChevronRight className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="mb-4 h-[420px] overflow-y-auto rounded-3xl border border-slate-200 bg-slate-50 p-4">
              <div className="space-y-3">
                {messages.map((message, index) => (
                  <div
                    key={`${message.role}-${index}`}
                    className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${
                      message.role === 'assistant'
                        ? 'bg-white text-slate-700 border border-slate-200'
                        : 'ml-auto bg-slate-900 text-white'
                    }`}
                  >
                    {message.content}
                  </div>
                ))}
                {loading && (
                  <div className="text-sm text-slate-400">正在建立 skill 会话...</div>
                )}
              </div>
            </div>

            <div className="flex gap-3">
              <textarea
                value={input}
                onChange={(event) => setInput(event.target.value)}
                placeholder="直接描述要评估的问题，例如：孩子最近不看人，也不爱和别人玩。"
                className="min-h-[96px] flex-1 rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800 outline-none focus:border-indigo-400"
              />
              <button
                type="button"
                disabled={sending || loading || !token}
                onClick={() => void sendMessage()}
                className="inline-flex h-fit items-center gap-2 rounded-3xl bg-indigo-600 px-5 py-3 text-sm font-semibold text-white hover:bg-indigo-700 disabled:bg-slate-400"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <ChevronRight className="h-4 w-4" />}
                <span>发送</span>
              </button>
            </div>

            <p className="mt-3 text-xs text-slate-500">
              当前实现已经强制要求所有 skill 请求携带 agent session token，并按当前成员隔离读取上下文。
            </p>
          </section>
        </div>
      </div>
    </div>
  );
}
