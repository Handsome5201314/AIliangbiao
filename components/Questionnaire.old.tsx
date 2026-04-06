/**
 * 问卷组件 - 处理量表答题逻辑
 */

'use client';

import { useState, useCallback, useEffect, useRef } from 'react';
import type { ScaleDefinition } from '@/lib/schemas/core/types';
import { ChevronLeft, CheckCircle2, Mic, MicOff, Volume2 } from 'lucide-react';
import { useProfile } from '@/contexts/ProfileContext';
import { useConversationHistory } from '@/contexts/ConversationHistoryContext';
import Avatar from './Avatar';
import AssessmentResult from './AssessmentResult';

interface QuestionnaireProps {
  scale: ScaleDefinition;
}

export default function Questionnaire({ scale }: QuestionnaireProps) {
  const { profile, updateProfile, updateAvatar } = useProfile();
  const { addMessage } = useConversationHistory();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<number[]>([]);
  const [isComplete, setIsComplete] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [result, setResult] = useState<{ 
    totalScore: number; 
    conclusion: string; 
    details?: { 
      description?: string; 
      [key: string]: unknown;
    }; 
  } | null>(null);
  
  // 语音识别状态
  const [isListening, setIsListening] = useState(false);
  const [isSupported, setIsSupported] = useState(false);
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const [voiceStatus, setVoiceStatus] = useState('点击麦克风开始语音答题');

  const currentQuestion = scale.questions[currentIndex];
  const progress = ((currentIndex + 1) / scale.questions.length) * 100;

  // 根据题目内容动态更新小人心情
  useEffect(() => {
    if (!currentQuestion || isComplete) return;

    const questionText = currentQuestion.text.toLowerCase();
    const colloquial = currentQuestion.colloquial.toLowerCase();

    // 根据关键词判断心情
    if (questionText.includes('社交') || questionText.includes('退缩') || 
        colloquial.includes('不理') || colloquial.includes('害怕') ||
        questionText.includes('焦虑')) {
      updateAvatar({ mood: 'nervous' });
    } else if (questionText.includes('兴趣') || questionText.includes('喜欢') ||
               colloquial.includes('喜欢') || colloquial.includes('有趣')) {
      updateAvatar({ mood: 'curious' });
    } else if (questionText.includes('快乐') || questionText.includes('开心') ||
               colloquial.includes('开心') || colloquial.includes('笑')) {
      updateAvatar({ mood: 'happy' });
    } else {
      updateAvatar({ mood: 'normal' });
    }
  }, [currentIndex, currentQuestion, isComplete, updateAvatar]);

  // 初始化语音识别
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      
      if (!SpeechRecognition) {
        setIsSupported(false);
        console.log('浏览器不支持语音识别');
        return;
      }

      // 检查是否是安全上下文
      if (location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
        setIsSupported(false);
        setVoiceStatus('语音识别需要 HTTPS 或 localhost 环境');
        console.log('语音识别需要 HTTPS 或 localhost 环境');
        return;
      }

      setIsSupported(true);
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'zh-CN';
      recognitionRef.current = recognition;
    }

    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, []);

  const handleAnswer = useCallback(async (score: number) => {
    const newAnswers = [...answers, score];
    setAnswers(newAnswers);

    if (currentIndex < scale.questions.length - 1) {
      setCurrentIndex(currentIndex + 1);
    } else {
      setIsSaving(true);
      
      try {
        // 计算评估结果
        const result = scale.calculateScore(newAnswers);
        
        // 获取或生成 deviceId
        let deviceId = localStorage.getItem('device_id');
        if (!deviceId) {
          deviceId = crypto.randomUUID();
          localStorage.setItem('device_id', deviceId);
        }

        // 保存到数据库
        const response = await fetch('/api/assessment/save', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            deviceId,
            scaleId: scale.id,
            totalScore: result.totalScore,
            conclusion: result.conclusion,
            answers: newAnswers,
          }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || '保存失败');
        }

        // 更新前端状态
        setResult(result);
        setIsComplete(true);
        
        // 更新已完成量表列表
        if (!profile.completedScales.includes(scale.id)) {
          updateProfile({
            completedScales: [...profile.completedScales, scale.id]
          });
        }

        // 完成奖励：戴上虎头帽，心情变开心
        updateAvatar({ 
          mood: 'happy',
          headwear: 'hu_tou_mao'
        });

      } catch (error) {
        console.error('Failed to save assessment:', error);
        const errorMessage = error instanceof Error ? error.message : '评估结果保存失败，请检查网络连接';
        alert(errorMessage);
      } finally {
        setIsSaving(false);
      }
    }
  }, [answers, currentIndex, scale, updateProfile, updateAvatar, profile.completedScales]);

  // 处理语音识别结果
  const handleVoiceResult = useCallback((transcript: string) => {
    const lowerTranscript = transcript.toLowerCase().trim();
    
    // 记录用户语音
    addMessage({
      role: 'user',
      content: transcript,
      scaleId: scale.id,
      action: 'question'
    });

    // 匹配选项
    const options = currentQuestion.options;
    let matchedIndex = -1;

    // 尝试匹配选项标签
    for (let i = 0; i < options.length; i++) {
      const optionLabel = options[i].label.toLowerCase();
      if (lowerTranscript.includes(optionLabel) || 
          lowerTranscript.includes(optionLabel.replace(/[是的没有不会从不很少]/g, ''))) {
        matchedIndex = i;
        break;
      }
    }

    // 关键词匹配
    if (matchedIndex === -1) {
      if (lowerTranscript.includes('总是') || lowerTranscript.includes('经常') || 
          lowerTranscript.includes('是的') || lowerTranscript.includes('对')) {
        matchedIndex = 0;
      } else if (lowerTranscript.includes('有时') || lowerTranscript.includes('偶尔')) {
        matchedIndex = Math.min(1, options.length - 1);
      } else if (lowerTranscript.includes('很少') || lowerTranscript.includes('几乎不')) {
        matchedIndex = Math.min(2, options.length - 1);
      } else if (lowerTranscript.includes('从不') || lowerTranscript.includes('没有') || 
                 lowerTranscript.includes('不会')) {
        matchedIndex = options.length - 1;
      }
    }

    // 数字匹配
    if (matchedIndex === -1) {
      const numbers = ['一', '二', '三', '四', '五', '1', '2', '3', '4', '5'];
      for (let i = 0; i < numbers.length; i++) {
        if (lowerTranscript.includes(numbers[i])) {
          matchedIndex = i % options.length;
          break;
        }
      }
    }

    if (matchedIndex >= 0 && matchedIndex < options.length) {
      setVoiceStatus(`识别成功："${options[matchedIndex].label}"`);
      setTimeout(() => {
        handleAnswer(options[matchedIndex].score);
      }, 800);
    } else {
      setVoiceStatus(`未识别到有效选项，请重试`);
    }
  }, [currentQuestion, handleAnswer, addMessage, scale.id]);

  // 开始/停止语音识别
  const toggleListening = useCallback(() => {
    if (!recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
      setVoiceStatus('点击麦克风开始语音答题');
    } else {
      recognitionRef.current.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        handleVoiceResult(transcript);
      };

      recognitionRef.current.onerror = (event) => {
        console.error('语音识别错误:', event.error);
        setIsListening(false);
        
        let errorMessage = '识别出错，请重试';
        
        switch(event.error) {
          case 'network':
            errorMessage = '网络连接失败，请检查网络或使用 VPN';
            break;
          case 'not-allowed':
            errorMessage = '请允许麦克风权限后重试';
            break;
          case 'no-speech':
            errorMessage = '未检测到语音，请说话后重试';
            break;
          case 'audio-capture':
            errorMessage = '未检测到麦克风设备';
            break;
          default:
            errorMessage = `识别出错: ${event.error}`;
        }
        
        setVoiceStatus(errorMessage);
      };

      recognitionRef.current.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current.start();
      setIsListening(true);
      setVoiceStatus('正在聆听，请说出您的答案...');
    }
  }, [isListening, handleVoiceResult]);

  // 播放题目（语音提示）
  const speakQuestion = useCallback(() => {
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(currentQuestion.colloquial);
      utterance.lang = 'zh-CN';
      utterance.rate = 0.9;
      speechSynthesis.speak(utterance);
    }
  }, [currentQuestion]);

  const handlePrevious = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setAnswers(answers.slice(0, -1));
    }
  }, [currentIndex, answers]);

  // 保存中状态
  if (isSaving) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-8">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
          <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-indigo-600 mx-auto mb-4"></div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">正在保存评估结果...</h2>
          <p className="text-gray-600">请稍候，数据正在安全保存中</p>
        </div>
      </div>
    );
  }

  // 完成状态
  if (isComplete && result) {
    // 获取 deviceId
    let deviceId = '';
    if (typeof window !== 'undefined') {
      deviceId = localStorage.getItem('device_id') || '';
    }

    return (
      <AssessmentResult
        result={result}
        scale={{
          id: scale.id,
          name: scale.title,
          questions: scale.questions
        }}
        answers={answers}
        deviceId={deviceId}
      />
    );
  }

  // 答题状态
  return (
    <div className="max-w-2xl mx-auto px-4 py-8 relative">
      {/* 左上角小人 - 陪伴答题 */}
      <div className="fixed top-4 left-4 z-10 bg-white/90 backdrop-blur-sm rounded-2xl p-3 shadow-lg">
        <Avatar 
          state={profile.avatarState}
          gender={profile.gender}
          className="w-16 h-16"
        />
        <div className="text-center mt-1 text-xs font-medium text-gray-600">
          {profile.nickname}
        </div>
      </div>

      {/* 进度条 */}
      <div className="mb-6">
        <div className="flex justify-between text-sm text-gray-600 mb-2">
          <span>题目 {currentIndex + 1} / {scale.questions.length}</span>
          <span>{Math.round(progress)}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div 
            className="bg-indigo-600 h-2 rounded-full transition-all duration-300"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* 题目卡片 */}
      <div className="bg-white rounded-2xl shadow-lg p-6 mb-4">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {currentQuestion.colloquial}
        </h3>
        <p className="text-sm text-gray-500 mb-6 italic">
          原题：{currentQuestion.text}
        </p>

        {/* 选项 */}
        <div className="space-y-3">
          {currentQuestion.options.map((option, idx) => (
            <button
              key={idx}
              onClick={() => handleAnswer(option.score)}
              className="w-full text-left p-4 rounded-xl border-2 border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 transition-all"
            >
              <div className="font-medium text-gray-900">{option.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* 语音交互区域 */}
      {isSupported && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Volume2 className="w-5 h-5 text-indigo-600" />
              <span className="text-sm font-medium text-gray-700">语音答题助手</span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={speakQuestion}
                className="px-3 py-1.5 bg-white rounded-lg border border-indigo-200 hover:bg-indigo-50 transition-colors text-sm text-indigo-700"
              >
                🔊 播放题目
              </button>
              <button
                onClick={toggleListening}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                  isListening 
                    ? 'bg-red-500 text-white animate-pulse' 
                    : 'bg-indigo-600 text-white hover:bg-indigo-700'
                }`}
              >
                {isListening ? (
                  <>
                    <MicOff className="w-4 h-4" />
                    停止
                  </>
                ) : (
                  <>
                    <Mic className="w-4 h-4" />
                    语音答题
                  </>
                )}
              </button>
            </div>
          </div>
          
          {/* 识别状态 */}
          <div className={`text-sm text-center py-2 rounded-lg ${
            voiceStatus.includes('识别成功') ? 'bg-green-100 text-green-700' :
            voiceStatus.includes('未识别') || voiceStatus.includes('出错') ? 'bg-red-100 text-red-700' :
            'bg-white text-gray-600'
          }`}>
            {isListening && (
              <span className="inline-flex items-center gap-2">
                <span className="animate-bounce">🎤</span>
                <span className="animate-pulse">{voiceStatus}</span>
              </span>
            )}
            {!isListening && voiceStatus !== '点击麦克风开始语音答题' && (
              <span>{voiceStatus}</span>
            )}
          </div>

          {/* 使用提示 */}
          <div className="mt-2 text-xs text-gray-500 text-center">
            💡 提示：可以说"选项一"、"是的"、"从不"等关键词
          </div>
        </div>
      )}

      {/* 追问提示 */}
      {currentQuestion.fallback_examples.length > 0 && (
        <div className="bg-amber-50 rounded-xl p-4 text-sm text-amber-800">
          <p className="font-semibold mb-1">💡 追问提示：</p>
          <p>{currentQuestion.fallback_examples[0]}</p>
        </div>
      )}

      {/* 返回按钮 */}
      {currentIndex > 0 && (
        <button
          onClick={handlePrevious}
          className="mt-4 flex items-center text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ChevronLeft className="w-5 h-5 mr-1" />
          上一题
        </button>
      )}
    </div>
  );
}
