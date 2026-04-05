/**
 * 分诊语音录制组件 - 使用 MediaRecorder API + 后端语音识别
 * 
 * 重构：使用 MediaRecorder API + 后端语音识别服务
 * 替代 Web Speech API（在中国网络环境下有兼容性问题）
 * 
 * 功能：
 * 1. 语音识别（MediaRecorder + 后端 API）
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
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [remainingQuota, setRemainingQuota] = useState<number | null>(null);
  
  // MediaRecorder 相关
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  // 初始化 MediaRecorder
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // 检查浏览器是否支持 MediaRecorder
      if (!window.MediaRecorder) {
        setError('您的浏览器不支持录音功能，请使用 Chrome 或 Edge 浏览器');
        return;
      }

      // 检查是否支持音频格式
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

    // 获取配额
    fetchQuota();

    return () => {
      // 清理：停止录音和释放麦克风
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, []);

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
      // 请求麦克风权限
      const stream = await navigator.mediaDevices.getUserMedia({ 
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        } 
      });
      
      streamRef.current = stream;
      audioChunksRef.current = [];

      // 确定支持的音频格式
      const mimeTypes = [
        'audio/webm;codecs=opus',
        'audio/webm',
        'audio/mp4',
        'audio/ogg',
        'audio/wav',
      ];

      const mimeType = mimeTypes.find(type => MediaRecorder.isTypeSupported(type)) || 'audio/webm';

      // 创建 MediaRecorder
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType,
        audioBitsPerSecond: 128000,
      });

      mediaRecorderRef.current = mediaRecorder;

      // 监听数据可用事件
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      // 监听录音停止事件
      mediaRecorder.onstop = async () => {
        // 停止麦克风
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }

        // 合并音频数据
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        
        // 上传音频进行转写
        await uploadAndTranscribe(audioBlob);
      };

      // 开始录音
      mediaRecorder.start();
      setIsRecording(true);
      setError(null);

      // 自动停止录音（最多 60 秒）
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

  // 停止录音
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
      // 获取 deviceId
      let deviceId = localStorage.getItem('device_id');
      if (!deviceId) {
        deviceId = crypto.randomUUID();
        localStorage.setItem('device_id', deviceId);
      }

      // 构建 FormData
      const formData = new FormData();
      formData.append('audio', audioBlob, 'recording.webm');
      formData.append('deviceId', deviceId);
      formData.append('context', 'triage');

      // 发送到后端 API
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
        // 更新配额
        setRemainingQuota(data.remaining);
        
        // 处理转写结果
        setTranscript(data.text);
        handleTranscript(data.text);
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
  }, [getContextWindow]);

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
      // 记录用户语音
      addMessage({
        role: 'user',
        content: text,
        action: 'triage'
      });

      // 使用 AI API 分析（系统会自动获取API密钥）
      const recommendedScale = await analyzeWithAI(text);
      
      // 记录AI推荐
      addMessage({
        role: 'assistant',
        content: `推荐量表：${recommendedScale}`,
        action: 'recommendation'
      });

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
    if (isTranscribing || isProcessing) return;

    setError(null);

    if (isRecording) {
      stopRecording();
    } else {
      setTranscript('');
      startRecording();
    }
  }, [isRecording, isTranscribing, isProcessing, startRecording, stopRecording]);

  return (
    <div className="flex flex-col items-center">
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
            {isTranscribing ? '正在识别...' : 'AI 正在分析...'}
          </span>
        </div>
      )}

      {/* 识别结果 */}
      {transcript && !isProcessing && (
        <div className="mb-2 text-xs text-gray-600 max-w-xs text-center">
          识别结果："{transcript}"
        </div>
      )}

      {/* 配额显示 */}
      {remainingQuota !== null && !isRecording && !isTranscribing && !isProcessing && (
        <div className="mb-2 text-xs text-gray-500">
          今日剩余：{remainingQuota} 次
        </div>
      )}

      {/* 录音按钮 */}
      <button
        onClick={toggleRecording}
        disabled={isTranscribing || isProcessing}
        className={`relative w-14 h-14 md:w-16 md:h-16 rounded-full flex items-center justify-center transition-all shadow-lg ${
          isTranscribing || isProcessing
            ? 'bg-gray-400 cursor-not-allowed'
            : isRecording
              ? 'bg-red-500 hover:bg-red-600 animate-pulse'
              : 'bg-gradient-to-br from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700'
        }`}
      >
        {isTranscribing || isProcessing ? (
          <Loader2 className="w-6 h-6 md:w-7 md:h-7 text-white animate-spin" />
        ) : isRecording ? (
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
        {isTranscribing || isProcessing 
          ? '处理中...' 
          : isRecording 
            ? '点击停止' 
            : '点击开始说话'}
      </p>
    </div>
  );
}
