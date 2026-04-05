/**
 * 分诊语音录制组件 - 使用系统配置的 AI API
 * 
 * 功能：
 * 1. 语音识别（Web Speech API）
 * 2. AI 分诊推荐（自动获取系统API密钥）
 * 3. 智能量表推荐
 * 4. 集成用户画像和对话历史上下文
 */

'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { Mic, MicOff, Loader2, AlertCircle } from 'lucide-react';
import { useProfile, useConversationHistory } from '@/contexts';

interface TriageVoiceRecorderProps {
  onStartScale: (scaleId: string) => void;
}

export default function TriageVoiceRecorder({ onStartScale }: TriageVoiceRecorderProps) {
  const { profile } = useProfile();
  const { addMessage, getContextWindow } = useConversationHistory();
  
  const [isRecording, setIsRecording] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<any>(null);

  // 初始化语音识别
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // 检查浏览器支持
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        setError('您的浏览器不支持语音识别，请使用 Chrome 或 Edge 浏览器');
        return;
      }

      // 检查是否是安全上下文
      if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        setError('语音识别需要 HTTPS 或 localhost 环境，请使用 http://localhost:3000 访问');
        return;
      }

      recognitionRef.current = new SpeechRecognition();
      recognitionRef.current.continuous = false;
      recognitionRef.current.interimResults = false;
      recognitionRef.current.lang = 'zh-CN';

      recognitionRef.current.onresult = (event: any) => {
        const text = event.results[0][0].transcript;
        setTranscript(text);
        handleTranscript(text);
      };

      recognitionRef.current.onerror = (event: any) => {
        console.error('Speech recognition error:', event.error);
        
        let errorMessage = '语音识别失败';
        
        switch(event.error) {
          case 'network':
            errorMessage = '网络连接失败。可能原因：\n• 需要访问 Google 服务（建议使用 VPN）\n• 请使用 localhost 而非 IP 地址\n• 检查网络连接';
            break;
          case 'not-allowed':
            errorMessage = '麦克风权限被拒绝。请点击地址栏左侧的图标，允许麦克风访问';
            break;
          case 'no-speech':
            errorMessage = '未检测到语音输入，请对着麦克风说话后重试';
            break;
          case 'audio-capture':
            errorMessage = '未检测到麦克风设备，请检查麦克风是否正确连接';
            break;
          case 'aborted':
            errorMessage = '语音识别被中止，请重试';
            break;
          case 'language-not-supported':
            errorMessage = '不支持当前语言';
            break;
          default:
            errorMessage = `语音识别失败: ${event.error}`;
        }
        
        setError(errorMessage);
        setIsRecording(false);
        setIsProcessing(false);
      };

      recognitionRef.current.onend = () => {
        setIsRecording(false);
      };
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  // 调用 AI API 进行分诊分析（使用系统配置的密钥）
  const analyzeWithAI = useCallback(async (text: string): Promise<string> => {
    // 从系统API获取密钥和配置
    const systemKeyRes = await fetch('/api/system/apikey');
    const systemKeyData = await systemKeyRes.json();
    
    if (!systemKeyData.success) {
      throw new Error(systemKeyData.error || '系统未配置API密钥，请联系管理员');
    }
    
    const { provider, apiKey, endpoint, model } = systemKeyData;

    // 获取用户画像上下文
    const deviceId = localStorage.getItem('device_id');
    let userContext = '';
    if (deviceId) {
      const contextRes = await fetch(`/api/profile/context?deviceId=${deviceId}`);
      const contextData = await contextRes.json();
      if (contextData.success && contextData.context) {
        userContext = contextData.context;
      }
    }

    // 获取对话历史
    const conversationHistory = getContextWindow(5);

    // 构建增强的System Prompt
    const systemPrompt = `你是一个专业的儿童心理评估分诊助手。根据家长描述的症状，推荐最合适的评估量表。

${userContext}

${conversationHistory}

可选量表：
- ABC：孤独症行为评定量表（适用于自闭症筛查，57题）
- CARS：卡氏儿童孤独症评定量表（适用于自闭症诊断，15题）
- SRS：社交反应量表（适用于社交能力评估，最全面）
- SNAP-IV：注意力量表（适用于多动症评估）

请根据症状关键词和用户画像，仅返回量表ID（ABC、CARS、SRS、SNAP-IV），不要返回其他内容。`;

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
            { role: 'system', content: systemPrompt },
            { role: 'user', content: text },
          ],
          temperature: 0.3,
          max_tokens: 50,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `API 调用失败: ${response.status}`);
      }

      const data = await response.json();
      const recommendation = data.choices?.[0]?.message?.content?.trim() || 'SRS';

      // 验证返回的量表ID是否有效
      const validScales = ['ABC', 'CARS', 'SRS', 'SNAP-IV'];
      if (validScales.includes(recommendation)) {
        return recommendation;
      }

      // 如果返回的不是有效ID，使用关键词匹配
      return fallbackMatching(text);

    } catch (error) {
      console.error('AI API error:', error);
      // API 调用失败，使用降级方案
      return fallbackMatching(text);
    }
  }, []);

  // 降级方案：关键词匹配
  const fallbackMatching = (text: string): string => {
    const lowerText = text.toLowerCase();
    
    if (lowerText.includes('社交') || lowerText.includes('人际关系') || lowerText.includes('孤独')) {
      return 'SRS';
    } else if (lowerText.includes('多动') || lowerText.includes('注意力') || lowerText.includes('冲动')) {
      return 'SNAP-IV';
    } else if (lowerText.includes('旋转') || lowerText.includes('刻板') || lowerText.includes('不理人')) {
      return 'ABC';
    } else if (lowerText.includes('模仿') || lowerText.includes('情感') || lowerText.includes('严重程度')) {
      return 'CARS';
    }
    
    return 'SRS'; // 默认推荐
  };

  const handleTranscript = useCallback(async (text: string) => {
    setIsProcessing(true);
    setError(null);

    try {
      // 使用 AI API 分析（系统会自动获取API密钥）
      const recommendedScale = await analyzeWithAI(text);
      onStartScale(recommendedScale);
    } catch (err) {
      console.error('Analysis error:', err);
      setError(err instanceof Error ? err.message : '分析失败');
      // 即使失败也提供默认推荐
      setTimeout(() => {
        onStartScale('SRS');
      }, 1000);
    } finally {
      setIsProcessing(false);
    }
  }, [analyzeWithAI, onStartScale, addMessage]);

  const toggleRecording = useCallback(() => {
    if (!recognitionRef.current) {
      setError('您的浏览器不支持语音识别功能，请使用 Chrome 浏览器');
      return;
    }

    setError(null);

    if (isRecording) {
      recognitionRef.current.stop();
      setIsRecording(false);
    } else {
      setTranscript('');
      recognitionRef.current.start();
      setIsRecording(true);
    }
  }, [isRecording]);

  return (
    <div className="flex flex-col items-center">
      {/* 错误提示 */}
      {error && (
        <div className="mb-2 flex items-center gap-2 text-rose-600 text-xs">
          <AlertCircle className="w-4 h-4" />
          <span>{error}</span>
        </div>
      )}

      {/* 状态显示 */}
      {isProcessing && (
        <div className="mb-2 flex items-center gap-2 text-indigo-600">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-xs font-medium">AI 正在分析...</span>
        </div>
      )}

      {/* 识别结果 */}
      {transcript && !isProcessing && (
        <div className="mb-2 text-xs text-gray-600 max-w-xs text-center">
          识别结果："{transcript}"
        </div>
      )}

      {/* 录音按钮 */}
      <button
        onClick={toggleRecording}
        disabled={isProcessing}
        className={`relative w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center transition-all shadow-lg ${
          isRecording
            ? 'bg-red-500 hover:bg-red-600 animate-pulse'
            : 'bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700'
        }`}
      >
        {isRecording ? (
          <MicOff className="w-6 h-6 md:w-7 md:h-7 text-white" />
        ) : (
          <Mic className="w-6 h-6 md:w-7 md:h-7 text-white" />
        )}

        {/* 录音波纹动画 */}
        {isRecording && (
          <div className="absolute inset-0 rounded-full border-4 border-red-300 animate-ping" />
        )}
      </button>

      {/* 提示文字 */}
      <p className="mt-2 text-[10px] md:text-xs text-slate-500 font-medium">
        {isRecording ? '点击停止' : '点击开始说话'}
      </p>
    </div>
  );
}
