'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

import type { LanguageCode } from '@/lib/schemas/core/types';

type SpeechPlaybackEventHandlers = {
  onStart?: (text: string) => void;
  onEnd?: () => void;
  onError?: (message: string) => void;
};

type SpeakOptions = {
  queueIfLocked?: boolean;
  fromUserGesture?: boolean;
};

type SpeakResult = {
  spoken: boolean;
  queued: boolean;
  reason?: 'unsupported' | 'locked' | 'voice_not_ready' | 'speak_failed';
};

let globalSpeechUnlocked = false;

function getSpeechSynthesisInstance() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    return null;
  }

  return window.speechSynthesis;
}

function getDefaultSpeechError(language: LanguageCode) {
  return language === 'en'
    ? 'Voice playback is unavailable in this browser.'
    : '当前浏览器暂不支持语音播报。';
}

function getUnlockPrompt(language: LanguageCode) {
  return language === 'en'
    ? 'Tap play to start voice guidance.'
    : '点击播放开始语音引导。';
}

function getVoiceNotReadyPrompt(language: LanguageCode) {
  return language === 'en'
    ? 'Voice engine is still loading. Please try again in a moment.'
    : '语音引擎正在准备中，请稍后重试。';
}

function getPlaybackFailedPrompt(language: LanguageCode) {
  return language === 'en'
    ? 'Voice playback failed. Please tap play again.'
    : '语音播报失败，请再次点击播放。';
}

function wait(ms: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function pickVoice(voices: SpeechSynthesisVoice[], language: LanguageCode) {
  const normalizedLanguage = language === 'en' ? 'en' : 'zh';
  const exactMatch = voices.find((voice) =>
    voice.lang.toLowerCase().startsWith(normalizedLanguage)
  );

  if (exactMatch) {
    return exactMatch;
  }

  return voices[0];
}

export function primeSpeechPlayback(language: LanguageCode = 'zh') {
  const synthesis = getSpeechSynthesisInstance();
  if (!synthesis) {
    return false;
  }

  if (globalSpeechUnlocked) {
    return true;
  }

  try {
    const unlockUtterance = new SpeechSynthesisUtterance(
      language === 'en' ? ' ' : '。'
    );
    unlockUtterance.volume = 0;
    unlockUtterance.rate = 1;
    synthesis.cancel();
    synthesis.speak(unlockUtterance);
    synthesis.cancel();
    globalSpeechUnlocked = true;
    return true;
  } catch {
    return false;
  }
}

export function useSpeechPlayback(
  language: LanguageCode,
  handlers: SpeechPlaybackEventHandlers = {}
) {
  const { onStart, onEnd, onError } = handlers;

  const [isSupported, setIsSupported] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(globalSpeechUnlocked);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isLoadingVoices, setIsLoadingVoices] = useState(true);
  const [lastError, setLastError] = useState<string | null>(null);
  const [lastSpokenText, setLastSpokenText] = useState('');
  const [pendingText, setPendingText] = useState('');

  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const pendingTextRef = useRef('');

  const syncVoices = useCallback(() => {
    const synthesis = getSpeechSynthesisInstance();
    if (!synthesis) {
      voicesRef.current = [];
      setIsSupported(false);
      setIsLoadingVoices(false);
      return [];
    }

    const voices = synthesis.getVoices();
    voicesRef.current = voices;
    setIsSupported(true);
    setIsLoadingVoices(voices.length === 0);
    return voices;
  }, []);

  useEffect(() => {
    const synthesis = getSpeechSynthesisInstance();
    if (!synthesis) {
      setIsSupported(false);
      setIsLoadingVoices(false);
      return;
    }

    setIsSupported(true);
    syncVoices();

    const handleVoicesChanged = () => {
      syncVoices();
    };

    const previousHandler = synthesis.onvoiceschanged;
    synthesis.onvoiceschanged = handleVoicesChanged;

    return () => {
      synthesis.onvoiceschanged = previousHandler;
    };
  }, [syncVoices]);

  useEffect(() => {
    setIsUnlocked(globalSpeechUnlocked);
  }, []);

  const stopPlayback = useCallback(() => {
    const synthesis = getSpeechSynthesisInstance();
    if (!synthesis) {
      return;
    }

    synthesis.cancel();
    utteranceRef.current = null;
    setIsSpeaking(false);
    onEnd?.();
  }, [onEnd]);

  const primePlayback = useCallback(() => {
    const unlocked = primeSpeechPlayback(language);
    if (unlocked) {
      setIsUnlocked(true);
      setLastError(null);
    }

    return unlocked;
  }, [language]);

  const ensureVoicesReady = useCallback(async () => {
    const existingVoices = syncVoices();
    if (existingVoices.length > 0) {
      return true;
    }

    for (let attempt = 0; attempt < 4; attempt += 1) {
      await wait(250);
      const nextVoices = syncVoices();
      if (nextVoices.length > 0) {
        return true;
      }
    }

    return false;
  }, [syncVoices]);

  const speakText = useCallback(
    async (text: string, options: SpeakOptions = {}): Promise<SpeakResult> => {
      const content = text.trim();
      setLastSpokenText(content);

      if (!content) {
        return { spoken: false, queued: false };
      }

      const synthesis = getSpeechSynthesisInstance();
      if (!synthesis) {
        const message = getDefaultSpeechError(language);
        setLastError(message);
        onError?.(message);
        return { spoken: false, queued: false, reason: 'unsupported' };
      }

      if (!globalSpeechUnlocked) {
        if (options.fromUserGesture) {
          primePlayback();
        }

        if (!globalSpeechUnlocked) {
          if (options.queueIfLocked !== false) {
            pendingTextRef.current = content;
            setPendingText(content);
          }

          const message = getUnlockPrompt(language);
          setLastError(message);
          return { spoken: false, queued: true, reason: 'locked' };
        }
      }

      setIsUnlocked(true);
      const requiresImmediateSpeak = options.fromUserGesture === true;
      if (requiresImmediateSpeak) {
        syncVoices();
      } else {
        setPendingText('');
        pendingTextRef.current = '';
      }

      const voicesReady = requiresImmediateSpeak ? true : await ensureVoicesReady();
      if (!voicesReady && voicesRef.current.length === 0) {
        const message = getVoiceNotReadyPrompt(language);
        pendingTextRef.current = content;
        setPendingText(content);
        setLastError(message);
        onError?.(message);
        return { spoken: false, queued: true, reason: 'voice_not_ready' };
      }

      try {
        synthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(content);
        const preferredVoice = pickVoice(voicesRef.current, language);

        if (preferredVoice) {
          utterance.voice = preferredVoice;
          utterance.lang = preferredVoice.lang;
        } else {
          utterance.lang = language === 'en' ? 'en-US' : 'zh-CN';
        }

        utterance.rate = language === 'en' ? 0.98 : 0.94;
        utterance.pitch = 1;

        utterance.onstart = () => {
          setIsSpeaking(true);
          setLastError(null);
          onStart?.(content);
        };

        utterance.onend = () => {
          setIsSpeaking(false);
          utteranceRef.current = null;
          pendingTextRef.current = '';
          setPendingText('');
          onEnd?.();
        };

        utterance.onerror = () => {
          const message = getPlaybackFailedPrompt(language);
          setIsSpeaking(false);
          pendingTextRef.current = content;
          setPendingText(content);
          setLastError(message);
          utteranceRef.current = null;
          onError?.(message);
        };

        utteranceRef.current = utterance;
        synthesis.speak(utterance);

        return { spoken: true, queued: false };
      } catch {
        const message = getPlaybackFailedPrompt(language);
        setIsSpeaking(false);
        pendingTextRef.current = content;
        setPendingText(content);
        setLastError(message);
        onError?.(message);
        return { spoken: false, queued: true, reason: 'speak_failed' };
      }
    },
    [ensureVoicesReady, language, onEnd, onError, onStart, primePlayback, syncVoices]
  );

  const replayPendingText = useCallback(async () => {
    if (!pendingTextRef.current) {
      return { spoken: false, queued: false } satisfies SpeakResult;
    }

    return speakText(pendingTextRef.current, {
      fromUserGesture: true,
      queueIfLocked: false,
    });
  }, [speakText]);

  return {
    isSupported,
    isUnlocked,
    isSpeaking,
    isLoadingVoices,
    lastError,
    lastSpokenText,
    pendingText,
    primePlayback,
    speakText,
    stopPlayback,
    replayPendingText,
    clearPlaybackError: () => setLastError(null),
  };
}
