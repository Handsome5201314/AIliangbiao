'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bot, ShieldCheck, Sparkles } from 'lucide-react';

import AgentWorkspace from '@/components/AgentWorkspace';
import AiAssistantDrawer from '@/components/AiAssistantDrawer';
import AiAssistantFullScreen from '@/components/AiAssistantFullScreen';
import AiAssistantLauncher from '@/components/AiAssistantLauncher';
import PlatformKnowledgePanel from '@/components/PlatformKnowledgePanel';
import { useAuthSession } from '@/contexts/AuthSessionContext';
import { useConversationHistory } from '@/contexts/ConversationHistoryContext';
import { useProfile } from '@/contexts/ProfileContext';
import type {
  AssistantTab,
  MobileAssistantAction,
  MobileAssistantStage,
} from '@/lib/agent/mobile-assistant';
import { resolveMobileAssistantStage } from '@/lib/agent/mobile-assistant';
import { getOrCreateGuestSessionId, peekGuestSessionId } from '@/lib/utils/guestSession';
import { generateUUID } from '@/lib/utils/uuid';

function getSessionDeviceId(isAuthenticated: boolean) {
  if (isAuthenticated) {
    return peekGuestSessionId() || generateUUID();
  }

  return getOrCreateGuestSessionId();
}

export default function MobileAgentWorkspace() {
  const { isAuthenticated } = useAuthSession();
  const { profile } = useProfile();
  const { messages } = useConversationHistory();
  const language = profile.languagePreference === 'en' ? 'en' : 'zh';
  const [stage, setStage] = useState<MobileAssistantStage>('collapsed');
  const [hasActivated, setHasActivated] = useState(false);
  const [assistantTab, setAssistantTab] = useState<AssistantTab>('chat');
  const [currentQuestionId, setCurrentQuestionId] = useState<number | null>(null);
  const [currentScaleId, setCurrentScaleId] = useState<string | null>(null);
  const [knowledgeOpen, setKnowledgeOpen] = useState(false);

  useEffect(() => {
    if (stage !== 'collapsed') {
      setHasActivated(true);
    }
  }, [stage]);

  useEffect(() => {
    if (stage === 'collapsed') {
      setKnowledgeOpen(false);
      return;
    }

    if (assistantTab === 'explanation' && currentQuestionId) {
      setKnowledgeOpen(true);
      return;
    }

    setKnowledgeOpen(false);
  }, [assistantTab, currentQuestionId, stage]);

  const copy = useMemo(
    () =>
      language === 'en'
        ? {
            launcherTitle: 'Open XiaoAn whenever you need guidance while answering.',
            launcherSubtitle:
              'Keep the scale page in view, lift the assistant halfway for quick help, or open it full screen for longer conversations.',
            launcherCta: 'Open Assistant',
            drawerTitle: 'XiaoAn screening assistant',
            drawerSubtitle: 'Half-open keeps the current question visible. Full screen is better for longer triage and reading.',
            fullscreenTitle: 'XiaoAn full-screen assistant',
            fullscreenSubtitle: 'Use full screen when you need longer replies, knowledge references, or uninterrupted voice guidance.',
            expandLabel: 'Full screen',
            collapseLabel: 'Back to half-open',
            closeAriaLabel: 'Close assistant',
            sheetCollapseLabel: 'Minimize assistant',
            chatTab: 'Chat',
            explanationTab: 'Explanation',
            historyTab: 'History',
            historyEmpty: 'Your recent assistant turns will appear here after you start chatting.',
            historyRoleUser: 'You',
            historyRoleAssistant: 'Assistant',
            heroTitle: 'Mobile-first screening assistant',
            heroBody:
              'On mobile we split the assistant into launcher, half-open drawer, and full screen, so you can keep answering while asking for help.',
            featureOne: 'Launcher stays above the safe area and is easy to reach in WeChat or H5 browsers.',
            featureTwo: 'Half-open drawer keeps the current question visible while exposing voice and text triage.',
            featureThree: 'Full screen gives you more room for long explanations, knowledge references, and continuous guidance.',
          }
        : {
            launcherTitle: '答题遇到卡点时，随时呼出小安助手。',
            launcherSubtitle:
              '保留量表页面可见，半展开时快速提问，全展开时连续语音或阅读长解释。',
            launcherCta: '打开助手',
            drawerTitle: '小安移动评估助手',
            drawerSubtitle: '半展开保留题面上下文，全展开更适合连续对话、知识解释和长内容阅读。',
            fullscreenTitle: '小安全屏助手',
            fullscreenSubtitle:
              '当你需要更长回复、查看知识引用或连续语音引导时，切到全屏会更稳。',
            expandLabel: '全展开',
            collapseLabel: '回到半展开',
            closeAriaLabel: '关闭助手',
            sheetCollapseLabel: '收起助手',
            chatTab: '对话',
            explanationTab: '解释',
            historyTab: '历史',
            historyEmpty: '开始和小安对话后，最近的问答会显示在这里。',
            historyRoleUser: '你',
            historyRoleAssistant: '小安',
            heroTitle: '移动端三态 AI 助手',
            heroBody:
              '我们把手机端助手拆成悬浮启动、半展开抽屉和全屏面板三种形态，让量表答题与 AI 协助可以同时存在。',
            featureOne: '悬浮启动按钮贴着安全区，不会在微信内打开时被底栏遮住。',
            featureTwo: '半展开抽屉便于边看题边问，避免每次都跳走当前题目。',
            featureThree: '全屏面板适合读长解释、看知识引用和连续语音沟通。',
          },
    [language]
  );

  const transitionStage = (action: MobileAssistantAction) => {
    setStage((current) => resolveMobileAssistantStage(current, action));
  };

  const tabItems: Array<{ id: AssistantTab; label: string }> = [
    { id: 'chat', label: copy.chatTab },
    { id: 'explanation', label: copy.explanationTab },
    { id: 'history', label: copy.historyTab },
  ];

  const historyPanel = (
    <div className="h-full overflow-y-auto bg-slate-50 px-4 py-4">
      {messages.length ? (
        <div className="space-y-3">
          {messages.slice(-12).reverse().map((message) => (
            <div key={message.id} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
              <div className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">
                {message.role === 'user' ? copy.historyRoleUser : copy.historyRoleAssistant}
              </div>
              <div className="mt-2 whitespace-pre-wrap text-sm leading-7 text-slate-700">
                {message.content}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-6 text-sm leading-7 text-slate-500">
          {copy.historyEmpty}
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-[100dvh] bg-[radial-gradient(circle_at_top,#dbeafe,transparent_42%),linear-gradient(180deg,#f8fafc_0%,#eef2ff_100%)]">
      <div className="px-4 pb-[calc(env(safe-area-inset-bottom)+132px)] pt-6">
        <div className="rounded-[2rem] border border-slate-200 bg-white/90 p-5 shadow-sm backdrop-blur">
          <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.24em] text-indigo-700">
            <Sparkles className="h-3.5 w-3.5" />
            <span>Mobile AI</span>
          </div>
          <div className="mt-4 flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-indigo-600 text-white shadow-lg shadow-indigo-200">
              <Bot className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{copy.heroTitle}</h1>
              <p className="mt-2 text-sm leading-7 text-slate-600">{copy.heroBody}</p>
            </div>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {[copy.featureOne, copy.featureTwo, copy.featureThree].map((item) => (
            <div
              key={item}
              className="flex items-start gap-3 rounded-[1.5rem] border border-slate-200 bg-white/80 p-4 text-sm leading-6 text-slate-600 shadow-sm backdrop-blur"
            >
              <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-600">
                <ShieldCheck className="h-4 w-4" />
              </div>
              <p>{item}</p>
            </div>
          ))}
        </div>
      </div>

      <AiAssistantLauncher
        hidden={stage !== 'collapsed'}
        title={copy.launcherTitle}
        subtitle={copy.launcherSubtitle}
        ctaLabel={copy.launcherCta}
        onOpen={() => {
          setAssistantTab('chat');
          transitionStage('open');
        }}
      />

      <AiAssistantDrawer
        mounted={hasActivated}
        stage={stage}
        title={copy.drawerTitle}
        subtitle={copy.drawerSubtitle}
        expandLabel={copy.expandLabel}
        collapseLabel={copy.sheetCollapseLabel}
        closeAriaLabel={copy.closeAriaLabel}
        onExpand={() => transitionStage('expand')}
        onCollapse={() => transitionStage('close')}
        onClose={() => transitionStage('close')}
        fullscreenHeader={
          <AiAssistantFullScreen
            title={copy.fullscreenTitle}
            subtitle={copy.fullscreenSubtitle}
            collapseLabel={copy.collapseLabel}
            closeAriaLabel={copy.closeAriaLabel}
            onCollapse={() => transitionStage('collapse')}
            onClose={() => transitionStage('close')}
          />
        }
      >
        <div className="border-b border-slate-200 bg-white px-4 py-3">
          <div className="grid grid-cols-3 gap-2">
            {tabItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setAssistantTab(item.id)}
                className={`rounded-full px-3 py-2 text-sm font-semibold transition ${
                  assistantTab === item.id
                    ? 'bg-indigo-600 text-white'
                    : 'border border-slate-200 bg-slate-50 text-slate-700 hover:bg-white'
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        {assistantTab === 'history' ? historyPanel : (
          <AgentWorkspace
            mobile
            mobileShellMode={stage === 'full' ? 'fullscreen' : 'drawer'}
            onRequestExpand={stage === 'half' ? () => transitionStage('expand') : undefined}
            onRequestCollapse={stage === 'full' ? () => transitionStage('collapse') : undefined}
            knowledgeOpenOverride={knowledgeOpen}
            onKnowledgeOpenChange={(open) => {
              setKnowledgeOpen(open);
              if (!open && assistantTab === 'explanation') {
                setAssistantTab('chat');
              }
            }}
            onCurrentQuestionChange={setCurrentQuestionId}
            onCurrentScaleChange={setCurrentScaleId}
            renderKnowledgePanel={false}
          />
        )}

        <PlatformKnowledgePanel
          isOpen={knowledgeOpen}
          onClose={() => {
            setKnowledgeOpen(false);
            setAssistantTab('chat');
          }}
          language={language}
          mobile
          deviceId={getSessionDeviceId(isAuthenticated)}
          memberId={profile.id}
          memberSnapshot={{
            nickname: profile.nickname,
            gender: profile.gender,
            ageMonths: profile.ageMonths,
            relation: profile.relation,
            languagePreference: profile.languagePreference,
            interests: profile.interests,
            fears: profile.fears,
            avatarConfig: profile.avatarState,
          }}
          scaleId={currentScaleId || ''}
          questionId={currentQuestionId}
        />
      </AiAssistantDrawer>
    </div>
  );
}
