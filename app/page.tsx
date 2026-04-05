'use client';

import { useCallback, useState, useEffect } from 'react';
import { AllScales } from '@/lib/schemas/core/registry';
import type { ScaleDefinition } from '@/lib/schemas/core/types';
import Questionnaire from '@/components/Questionnaire';
import TriageVoiceRecorder from '@/components/TriageVoiceRecorder';
import ProfileSetupModal from '@/components/ProfileSetupModal';
import { useAssessment, useProfile } from '@/contexts';
import Avatar from '@/components/Avatar';
import { Mic, Heart, Users, Brain, Eye, ArrowLeft, Sparkles, LayoutDashboard } from 'lucide-react';

// 量表卡片配置 (匹配底层 registry 中的大写 ID)
const SCALE_CARDS = [
  {
    id: 'SRS',
    icon: <Users className="w-6 h-6 text-blue-500" />,
    bgColor: 'bg-blue-50',
    gradient: 'from-blue-500 to-blue-600',
    tag: '最全面'
  },
  {
    id: 'ABC',
    icon: <Heart className="w-6 h-6 text-rose-500" />,
    bgColor: 'bg-rose-50',
    gradient: 'from-rose-500 to-rose-600',
    tag: null
  },
  {
    id: 'CARS',
    icon: <Brain className="w-6 h-6 text-purple-500" />,
    bgColor: 'bg-purple-50',
    gradient: 'from-purple-500 to-purple-600',
    tag: '较快捷'
  },
  {
    id: 'SNAP-IV',
    icon: <Eye className="w-6 h-6 text-amber-500" />,
    bgColor: 'bg-amber-50',
    gradient: 'from-amber-500 to-amber-600',
    tag: '多动症专病'
  }
];

function getScaleCardConfig(scaleId: string) {
  return SCALE_CARDS.find(card => card.id === scaleId);
}

function getEstimatedTime(questionCount: number): string {
  if (questionCount <= 20) return '约 5 分钟';
  if (questionCount <= 40) return '约 8 分钟';
  if (questionCount <= 60) return '约 12 分钟';
  return '约 15 分钟';
}

/** 设置按钮组件 - 跳转到管理后台 */
function SettingsButton() {
  return (
    <a
      href="/admin"
      className="relative flex items-center justify-center w-10 h-10 rounded-full hover:bg-slate-200/50 transition-colors text-slate-500 hover:text-slate-800"
      title="管理后台"
    >
      <LayoutDashboard className="w-5 h-5" />
    </a>
  );
}

export default function Home() {
  const { currentScale, setCurrentScale, resetAssessment } = useAssessment();
  const { profile } = useProfile();
  const [quota, setQuota] = useState<{ remaining: number; dailyLimit: number } | null>(null);

  // 页面加载时检查额度
  useEffect(() => {
    // 获取或生成 deviceId
    let deviceId = localStorage.getItem('device_id');
    if (!deviceId) {
      deviceId = crypto.randomUUID();
      localStorage.setItem('device_id', deviceId);
    }

    // 检查剩余额度
    fetch(`/api/quota/check?deviceId=${deviceId}`)
      .then(res => res.json())
      .then(data => {
        if (data.remaining !== undefined) {
          setQuota({ remaining: data.remaining, dailyLimit: data.dailyLimit });
        }
      })
      .catch(err => console.error('Failed to check quota:', err));
  }, []);

  const handleBackToHall = useCallback(() => {
    resetAssessment();
  }, [resetAssessment]);

  const handleScaleSelect = useCallback((scale: ScaleDefinition) => {
    setCurrentScale(scale);
  }, [setCurrentScale]);

  const handleAgentScaleSelect = useCallback((scaleId: string) => {
    // 忽略大小写进行匹配，增强容错性
    const scale = AllScales.find(s => s.id.toUpperCase() === scaleId.toUpperCase());
    if (scale) {
      setCurrentScale(scale);
    }
  }, [setCurrentScale]);

  // ========= 答题状态布局 =========
  if (currentScale) {
    const cardConfig = getScaleCardConfig(currentScale.id);
    
    return (
      <div className="min-h-screen bg-[#F8FAFC]">
        <nav className="bg-white border-b border-slate-100 px-6 py-4 flex items-center sticky top-0 z-10">
          <button 
            onClick={handleBackToHall}
            className="group flex items-center text-slate-500 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft className="w-5 h-5 mr-2 transform group-hover:-translate-x-1 transition-transform" />
            <span className="text-sm font-medium">返回量表大厅</span>
          </button>
          <div className="ml-8 h-4 w-[1px] bg-slate-200"></div>
          <div className="ml-4 flex items-center gap-2">
            <div className={`w-8 h-8 ${cardConfig?.bgColor || 'bg-slate-100'} rounded-lg flex items-center justify-center`}>
              {cardConfig?.icon || <Sparkles className="w-4 h-4 text-slate-500" />}
            </div>
            <span className="text-slate-800 font-semibold">{currentScale.title}</span>
          </div>
          <div className="ml-auto">
            <SettingsButton />
          </div>
        </nav>

        <main className="py-8">
          {/* 确保您的项目中已存在 Questionnaire 组件 */}
          <Questionnaire scale={currentScale} /> 
        </main>
      </div>
    );
  }

  // ========= 首页：自适应 & 防遮挡 & Dock修复 =========
  return (
    <div className="min-h-screen flex flex-col bg-[#F8FAFC] relative overflow-hidden">
      {/* 背景光晕 */}
      <div className="absolute top-0 inset-x-0 h-64 bg-gradient-to-b from-blue-100/50 to-transparent pointer-events-none" />

      {/* 头部导航 */}
      <header className="px-6 py-5 md:py-6 flex flex-col md:flex-row md:items-center justify-between shrink-0 relative z-50 max-w-[1400px] mx-auto w-full gap-4">
        <div>
          <div className="inline-flex items-center text-indigo-600 text-xs font-bold mb-1.5 tracking-wider">
            <Sparkles className="w-3.5 h-3.5 mr-1" />
            AI 临床辅助评估系统 · BYOK 模式
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">
            {profile.nickname === '宝宝' 
              ? '宝宝成长了解之旅' 
              : `${profile.nickname}的成长守护之旅`
            }
          </h1>
          {profile.nickname !== '宝宝' && (
            <p className="text-sm text-slate-500 mt-1 flex items-center gap-2">
              <span className="inline-block w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse"></span>
              欢迎回来，{profile.nickname}的守护者
            </p>
          )}
        </div>
        
        <div className="flex items-center gap-4 self-end md:self-auto">
          {/* 额度显示 */}
          {quota && (
            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-200">
              <span className="text-sm font-medium text-slate-700">
                今日剩余：{quota.remaining}/{quota.dailyLimit} 次
              </span>
            </div>
          )}
          
          {/* 宝宝头像展示 */}
          <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-full border border-slate-200">
            <Avatar 
              state={profile.avatarState}
              gender={profile.gender}
              className="w-6 h-6"
            />
            <span className="text-sm font-medium text-slate-700 hidden sm:inline">{profile.nickname}</span>
          </div>
          <SettingsButton />
        </div>
      </header>

      {/* 个性化欢迎横幅 (已建档用户专属) */}
      {profile.nickname !== '宝宝' && (
        <div className="px-4 md:px-6 mb-6 max-w-[1400px] mx-auto w-full relative z-0">
          <div className="bg-gradient-to-r from-indigo-500 via-purple-500 to-rose-400 rounded-2xl p-4 md:p-5 text-white shadow-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12"></div>
            
            <div className="relative flex items-center gap-4">
              <div className="shrink-0">
                <Avatar 
                  state={profile.avatarState}
                  gender={profile.gender}
                  className="w-16 h-16 md:w-20 md:h-20 drop-shadow-lg"
                />
              </div>
              <div className="flex-1 min-w-0">
                <h2 className="text-lg md:text-xl font-bold mb-1">
                  ✨ {profile.nickname}的成长档案已建立
                </h2>
                <p className="text-sm md:text-base text-white/90">
                  {profile.gender === 'boy' ? '他' : '她'}今年 {Math.floor(profile.ageMonths / 12)} 岁 {profile.ageMonths % 12} 个月
                  {profile.interests.length > 0 && ` · 喜欢 ${profile.interests.slice(0, 2).join('、')}`}
                </p>
                <p className="text-xs text-white/75 mt-1">
                  已完成 {profile.completedScales.length} 次评估
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 主体卡片区域 */}
      <main className="flex-1 px-4 md:px-6 pb-44 md:pb-48 w-full max-w-[1400px] mx-auto flex flex-col justify-center relative z-10">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5 w-full">
          {AllScales.map((scale) => {
            const cardConfig = getScaleCardConfig(scale.id);
            const estimatedTime = getEstimatedTime(scale.questions.length);
            
            return (
              <div 
                key={scale.id}
                onClick={() => handleScaleSelect(scale)}
                className="group bg-white rounded-2xl p-5 border border-slate-200 hover:border-indigo-300 hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative flex flex-col cursor-pointer h-full"
              >
                {cardConfig?.tag && (
                  <span className="absolute top-4 right-4 bg-indigo-50 text-indigo-600 text-[10px] md:text-xs font-bold px-2.5 py-1 rounded-full">
                    {cardConfig.tag}
                  </span>
                )}
                
                <div className="flex items-center gap-3 mb-4 pr-12">
                  <div className={`w-12 h-12 ${cardConfig?.bgColor || 'bg-slate-50'} rounded-xl flex items-center justify-center group-hover:bg-gradient-to-br ${cardConfig?.gradient || 'from-slate-400 to-slate-500'} group-hover:text-white transition-all duration-300 shrink-0 shadow-sm`}>
                    {cardConfig?.icon || <Sparkles className="w-6 h-6 text-slate-500" />}
                  </div>
                  <div>
                    <h3 className="text-lg md:text-xl font-bold text-slate-900 group-hover:text-indigo-600 transition-colors leading-tight">
                      {scale.id} {/* 使用量表ID作为简写，例如 ABC */}
                    </h3>
                    <p className="text-[10px] md:text-xs font-semibold text-slate-400 mt-0.5 uppercase tracking-wide truncate w-32">
                      {scale.title}
                    </p>
                  </div>
                </div>
                
                <p className="text-slate-600 text-sm leading-relaxed mb-6 flex-1 line-clamp-3">
                  {scale.description}
                </p>

                <div className="mt-auto flex flex-col gap-3">
                  <div className="flex items-center justify-between text-xs font-medium text-slate-500 px-1">
                    <span className="flex items-center">
                      <span className="w-1.5 h-1.5 bg-slate-300 rounded-full mr-1.5"></span>
                      {scale.questions.length} 题
                    </span>
                    <span className="flex items-center">
                      <span className="w-1.5 h-1.5 bg-slate-300 rounded-full mr-1.5"></span>
                      {estimatedTime}
                    </span>
                  </div>
                  <button className="w-full flex items-center justify-center space-x-2 bg-slate-900 text-white py-2.5 md:py-3 rounded-xl hover:bg-indigo-600 hover:shadow-md transition-all group-hover:bg-indigo-600 active:scale-95">
                    <span className="text-sm md:text-base font-bold">开启评估</span>
                    <Mic className="w-4 h-4 md:w-5 md:h-5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </main>

      {/* 底部悬浮语音组件（Dock修复版） */}
      <div className="fixed bottom-6 left-1/2 transform -translate-x-1/2 z-50 flex flex-col items-center pointer-events-none w-full px-4 max-w-[95%] md:max-w-3xl">
        <div className="pointer-events-auto bg-white/95 backdrop-blur-xl shadow-[0_20px_60px_-15px_rgba(0,0,0,0.2)] border border-slate-200/80 rounded-[2rem] p-3 md:py-3 md:px-5 flex flex-col md:flex-row items-center gap-2 md:gap-5 transition-all">
          
          <div className="hidden md:flex flex-col items-start gap-0.5 pl-2">
            <div className="flex items-center gap-1.5 text-indigo-600 font-bold text-sm">
              <Sparkles className="w-4 h-4" />
              <span>智能语音辅诊助手</span>
            </div>
            <p className="text-slate-500 text-xs whitespace-nowrap">直接点击右侧话筒，向 AI 描述宝宝症状</p>
          </div>
          
          <div className="hidden md:block h-10 w-[1px] bg-slate-200"></div>
          
          <div className="shrink-0 relative flex flex-col items-center justify-center min-w-[80px]
            [&>div]:!bg-transparent 
            [&>div]:!shadow-none 
            [&>div]:!border-none 
            [&>div]:!p-0 
            [&>div]:!m-0
            [&_p]:!mt-1 [&_p]:!text-[11px]
          ">
             {/* 确保您的项目中已存在 TriageVoiceRecorder 组件 */}
             <TriageVoiceRecorder onStartScale={handleAgentScaleSelect} />
          </div>

        </div>
        
        <div className="mt-3 text-center pointer-events-auto hidden sm:block">
          <p className="text-slate-400 text-[10px] md:text-xs font-medium drop-shadow-sm">
            评估结果仅供参考 · 纯本地引擎严格保护您的隐私信息
          </p>
        </div>
      </div>

      {/* 首次进入引导建档弹窗 */}
      <ProfileSetupModal />

    </div>
  );
}