/**
 * 分诊语音录制组件 V2 - 实现三步走流程
 * 
 * 流程：
 * 1. 共情与追问分诊
 * 2. 推荐与征求同意
 * 3. 移交量表引擎
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Mic, MicOff, Loader2, AlertCircle, MessageCircle, ArrowRight } from 'lucide-react';
import { useProfile, useConversationHistory } from '@/contexts';
import {
  TriageContext,
  defaultTriageContext,
  parseAIResponse,
  generateTriagePrompt,
  TRIAGE_SYSTEM_PROMPT,
} from '@/lib/services/triageFlow';

interface TriageVoiceRecorderProps {
  onStartScale: (scaleId: string) => void;
}

export default function TriageVoiceRecorder({ onStartScale }: TriageVoiceRecorderProps) {
  const { profile } = useProfile();
  const { addMessage, getContextWindow } = useConversationHistory();
  
  // 分诊状态
  const [triageContext, setTriageContext] = useState<TriageContext>(defaultTriageContext);
  const [sessionId, setSessionId] = useState<string | null>(null);
  
  // 录音状态
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [remainingQuota, setRemainingQuota] = useState<number | null>(null);
  
  // AI 响应
  const [aiResponse, setAiResponse] = useState<string>('');
  
  // MediaRecorder 相关
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // 初始化
  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (!window.MediaRecorder) {
        setError('您的浏览器不支持录音功能，请使用 Chrome 或 Edge 浏览器');
        return;
      }

      const mimeTypes = [
        'audio/webm',
        'audio/webm;codecs=opus',
        'audio/mp4',
        'audio/ogg',
        'audio/wav',
      ];

      const supportedType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type));
      
      if (!supportedType) {
        setError('浏览器不支持音频格式');
        return;
      }
    }

    fetchQuota();
    initTriage();
    loadSession(); // ✅ 新增：加载上次未完成的会话

    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

  // 加载上次未完成的分诊会话（断点续诊）
  const loadSession = async () => {
    try {
      const deviceId = localStorage.getItem('device_id');
      if (!deviceId) return;

      const response = await fetch(`/api/triage/session?deviceId=${deviceId}`);
      if (!response.ok) return;

      const data = await response.json();
      
      if (data.session) {
        const session = data.session;
        
        // 恢复上下文
        setSessionId(session.id);
        setTriageContext({
          state: session.status === 'CONSENT' ? 'consent' : 'triage',
          symptoms: session.symptoms || [],
          conversationHistory: session.conversationHistory || [],
          recommendedScale: session.recommendedScale || undefined,
          consentGiven: false,
          userProfile: {
            childName: profile.nickname,
            childAge: profile.ageMonths,
          },
        });

        console.log('[Triage] 恢复上次会话:', session.id);
      }
    } catch (error) {
      console.error('[Load Session Error]:', error);
    }
  };

  // 初始化分诊流程
  const initTriage = () => {
    setTriageContext({
      ...defaultTriageContext,
      state: 'initial',
      userProfile: {
        childName: profile.nickname,
        childAge: profile.ageMonths,
        parentName: undefined, // 可以从 profile 中获取
      },
    });
  };

  const fetchQuota = async () => {
    try {
      const deviceId = localStorage.getItem('device_id');
      if (!deviceId) return;

      const response = await fetch(`/api/speech/transcribe?deviceId=${deviceId}`);
      if (response.ok) {
        const data = await response.json();
        setRemainingQuota(data.remaining);
      }
    } catch (error) {
      console.error('Failed to fetch quota:', error);
    }
  };

  // 开始录音
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        } 
      });
      
      streamRef.current = stream;
      audioChunksRef.current = [];

      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg',
        'audio/wav',
      ];

      const mimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || 'audio/webm';

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 64000,  // 🚀 优化：从 128k 降低到 64k，减少 50% 上传时间
      });

      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        await uploadAndTranscribe(audioBlob);
      };

      mediaRecorder.start();
      setIsRecording(true);
      setError(null);

      setTimeout(() => {
        if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
          stopRecording();
        }
      }, 60000);

    } catch (error: any) {
      console.error('Failed to start recording:', error);
      
      let errorMessage = '录音启动失败';
      if (error.name === 'NotAllowedError') {
        errorMessage = '麦克风权限被拒绝，请点击地址栏左侧的图标，允许麦克风访问';
      } else if (error.name === 'NotFoundError') {
        errorMessage = '未检测到麦克风设备，请检查麦克风是否正确连接';
      }
      
      setError(errorMessage);
      setIsRecording(false);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  }, []);

  // 上传并转写音频
  const uploadAndTranscribe = useCallback(async (audioBlob: Blob) => {
    setIsTranscribing(true);

    try {
      let deviceId = localStorage.getItem('device_id');
      if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem('device_id', deviceId);
      }

      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('deviceId', deviceId);
      formData.append('context', 'triage');

      const response = await fetch('/api/speech/transcribe', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '语音识别失败');
      }

      const data = await response.json();

      if (data.success && data.text) {
        setRemainingQuota(data.remaining);
        setTranscript(data.text);
        await handleUserMessage(data.text);
      } else {
        throw new Error('未识别到有效语音');
      }

    } catch (error: any) {
      console.error('Transcription error:', error);
      setError(error.message || '语音识别失败，请重试');
    } finally {
      setIsTranscribing(false);
    }
  }, []);

  // 处理用户消息（核心分诊逻辑）
  const handleUserMessage = useCallback(async (userMessage: string) => {
    setIsProcessing(true);
    setError(null);

    try {
      // 🔧 修复二：意图短路机制 - 识别用户是否主动要求量表
      const explicitScaleRequest = /(?:填|做|测|用|哪个).*量表|推荐.*量表|直接开始|好.*开始|开始吧|可以.*开始/.test(userMessage);
      
      if (explicitScaleRequest && triageContext.state === 'triage') {
        // 强制跳转到 consent 状态，告诉 AI 用户急切，直接推荐量表
        setTriageContext(prev => ({
          ...prev,
          state: 'consent',
          symptoms: prev.symptoms.length >= 2 ? prev.symptoms : [...prev.symptoms, '用户明确要求量表'],
        }));
      }

      // 记录用户消息
      const newHistory = [
        ...triageContext.conversationHistory,
        { role: 'user' as const, content: userMessage, timestamp: Date.now() }
      ];

      setTriageContext(prev => ({
        ...prev,
        conversationHistory: newHistory,
      }));

      // 调用 AI 进行分诊对话
      const aiResponseText = await callTriageAI(userMessage, triageContext);
      
      // 解析 AI 响应
      const parsed = parseAIResponse(aiResponseText);
      
      // 显示 AI 响应
      setAiResponse(parsed.text);
      
      // 记录 AI 响应
      const updatedHistory = [
        ...newHistory,
        { role: 'assistant' as const, content: parsed.text, timestamp: Date.now() }
      ];

      // 根据解析结果更新状态
      if (parsed.action === 'recommend' && parsed.scaleId) {
        // 推荐量表并征求同意
        setTriageContext(prev => ({
          ...prev,
          state: 'consent',
          conversationHistory: updatedHistory,
          recommendedScale: parsed.scaleId,
        }));
        
        // 语音播报
        speakText(parsed.text);
        
        // ✅ 保存会话状态
        saveSession('CONSENT', triageContext.symptoms, updatedHistory, parsed.scaleId);
        
      } else if (parsed.action === 'start_scale' && parsed.scaleId) {
        // 家长同意，开始量表
        setTriageContext(prev => ({
          ...prev,
          state: 'handoff',
          conversationHistory: updatedHistory,
          consentGiven: true,
        }));
        
        // 语音播报
        speakText(parsed.text);
        
        // ✅ 标记会话为已完成
        if (sessionId) {
          await fetch(`/api/triage/session?sessionId=${sessionId}`, { method: 'DELETE' });
        }
        
        // 延迟后跳转到量表
        setTimeout(() => {
          onStartScale(parsed.scaleId!);
        }, 2000);
        
      } else {
        // 正常对话，收集症状
        const symptoms = extractSymptoms(userMessage, triageContext.symptoms);
        
        setTriageContext(prev => ({
          ...prev,
          state: symptoms.length >= 2 ? 'consent' : 'triage',
          conversationHistory: updatedHistory,
          symptoms,
        }));
        
        // 语音播报
        speakText(parsed.text);
        
        // ✅ 保存会话状态
        saveSession('ONGOING', symptoms, updatedHistory, undefined);
      }

      // 记录到对话历史
      addMessage({
        role: 'user',
        content: userMessage,
        action: 'triage'
      });

      addMessage({
        role: 'assistant',
        content: parsed.text,
        action: parsed.action || 'triage'
      });

    } catch (err) {
      console.error('Triage error:', err);
      setError(err instanceof Error ? err.message : '分析失败');
    } finally {
      setIsProcessing(false);
    }
  }, [triageContext, addMessage]);

  // 调用分诊 AI
  const callTriageAI = async (userMessage: string, context: TriageContext): Promise<string> => {
    // 获取系统 API Key
    const systemKeyRes = await fetch('/api/system/apikey');
    const systemKeyData = await systemKeyRes.json();
    
    if (!systemKeyData.success) {
      throw new Error(systemKeyData.error || '系统未配置API密钥');
    }
    
    const { provider, apiKey, endpoint, model } = systemKeyData;

    // 生成分诊对话 prompt
    const userPrompt = generateTriagePrompt(userMessage, context, profile);

    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: 'system', content: TRIAGE_SYSTEM_PROMPT },
            { role: 'user', content: userPrompt },
          ],
          temperature: 0.7,
          max_tokens: 200,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API 调用失败: ${response.status}`);
      }

      const data = await response.json();
      return data.choices?.[0]?.message?.content?.trim() || '抱歉，我没听清楚，能再说一遍吗？';

    } catch (error) {
      console.error('AI API error:', error);
      throw error;
    }
  };

  // 提取症状
  const extractSymptoms = (message: string, existingSymptoms: string[]): string[] => {
    // 简单的关键词提取（实际项目中可以使用 NLP）
    const symptomKeywords = [
      '不和人交流', '不爱说话', '不理人', '不看你',
      '喜欢转东西', '刻板行为', '重复动作',
      '注意力不集中', '多动', '坐不住',
      '社交困难', '不合群', '不和其他小朋友玩',
    ];

    const symptoms = [...existingSymptoms];
    
    symptomKeywords.forEach(keyword => {
      if (message.includes(keyword) && !symptoms.includes(keyword)) {
        symptoms.push(keyword);
      }
    });

    return symptoms;
  };

  // 语音播报
  const speakText = (text: string) => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'zh-CN';
      utterance.rate = 0.9;
      speechSynthesis.speak(utterance);
    }
  };

  // 保存分诊会话到数据库
  const saveSession = async (
    status: string,
    symptoms: string[],
    conversationHistory: any[],
    recommendedScale?: string
  ) => {
    try {
      const deviceId = localStorage.getItem('device_id');
      if (!deviceId) return;

      const response = await fetch('/api/triage/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          deviceId,
          sessionId,
          status,
          symptoms,
          conversationHistory,
          recommendedScale,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        if (data.session && !sessionId) {
          setSessionId(data.session.id);
          console.log('[Triage] 创建新会话:', data.session.id);
        }
      }
    } catch (error) {
      console.error('[Save Session Error]:', error);
    }
  };

  const toggleRecording = useCallback(() => {
    if (isTranscribing || isProcessing) return;

    setError(null);

    if (isRecording) {
      stopRecording();
    } else {
      setTranscript('');
      setAiResponse('');
      startRecording();
    }
  }, [isRecording, isTranscribing, isProcessing, startRecording, stopRecording]);

  return (
    <div className="flex flex-col items-center max-w-md mx-auto">
      {/* AI 响应显示 */}
      {aiResponse && !isProcessing && (
        <div className="mb-4 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-xl border border-blue-200 w-full">
          <div className="flex items-start gap-2">
            <MessageCircle className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
            <p className="text-sm text-gray-700 leading-relaxed">{aiResponse}</p>
          </div>
        </div>
      )}

      {/* 错误提示 */}
      {error && (
        <div className="mb-2 flex items-center gap-2 text-rose-600 text-xs max-w-xs text-center">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 状态显示 */}
      {(isTranscribing || isProcessing) && (
        <div className="mb-2 flex items-center gap-2 text-indigo-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs font-medium">
            {isTranscribing ? '正在识别...' : 'AI 正在思考...'}
          </span>
        </div>
      )}

      {/* 识别结果 */}
      {transcript && !isProcessing && (
        <div className="mb-2 text-xs text-gray-600 max-w-xs text-center">
          您说："{transcript}"
        </div>
      )}

      {/* 配额显示 */}
      {remainingQuota !== null && !isRecording && !isTranscribing && !isProcessing && (
        <div className="mb-2 text-xs text-gray-500">
          今日剩余：{remainingQuota} 次
        </div>
      )}

      {/* 分诊阶段提示 */}
      {triageContext.state !== 'assessment' && (
        <div className="mb-3 text-xs text-gray-500 text-center">
          {triageContext.state === 'initial' && '💡 点击麦克风，告诉我孩子的情况'}
          {triageContext.state === 'triage' && '💬 正在了解孩子的情况...'}
          {triageContext.state === 'consent' && '📋 已推荐量表，等待您的确认'}
          {triageContext.state === 'handoff' && '✅ 即将开始评估...'}
        </div>
      )}

      {/* 🔧 修复三：物理确认按钮（兜底机制） */}
      {triageContext.state === 'consent' && triageContext.recommendedScale && (
        <button 
          onClick={() => {
            onStartScale(triageContext.recommendedScale!);
          }}
          className="mt-3 bg-emerald-500 hover:bg-emerald-600 text-white font-bold px-6 py-2.5 rounded-full shadow-md transition-all active:scale-95 flex items-center gap-2 animate-in fade-in slide-in-from-bottom-2"
        >
          <span>直接开始 {triageContext.recommendedScale} 评估</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      )}

      {/* 录音按钮 */}
      <button
        onClick={toggleRecording}
        disabled={isTranscribing || isProcessing}
        className={`relative w-16 h-16 rounded-full flex items-center justify-center transition-all shadow-lg ${
          isTranscribing || isProcessing
            ? 'bg-gray-400 cursor-not-allowed'
            : isRecording
              ? 'bg-red-500 hover:bg-red-600 animate-pulse'
              : 'bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700'
        }`}
      >
        {isTranscribing || isProcessing ? (
          <Loader2 className="w-7 h-7 text-white animate-spin" />
        ) : isRecording ? (
          <MicOff className="w-7 h-7 text-white" />
        ) : (
          <Mic className="w-7 h-7 text-white" />
        )}

        {isRecording && (
          <div className="absolute inset-0 rounded-full border-4 border-red-300 animate-ping" />
        )}
      </button>

      {/* 提示文字 */}
      <p className="mt-2 text-xs text-slate-500 font-medium">
        {isTranscribing || isProcessing 
          ? '处理中...' 
          : isRecording 
            ? '点击停止' 
            : '点击开始说话'}
      </p>
    </div>
  );
}
