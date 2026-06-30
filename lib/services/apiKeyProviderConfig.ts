export type ApiServiceType = 'text' | 'asr' | 'tts';
export type LegacyApiServiceType = ApiServiceType | 'speech';

export const API_SERVICE_TYPES: ApiServiceType[] = ['text', 'asr', 'tts'];

type ProviderDefaultConfig = {
  textEndpoint: string;
  textModel: string;
  asrEndpoint: string;
  asrModel: string;
  ttsEndpoint: string;
  ttsModel: string;
  speechEndpoint: string;
  speechModel: string;
  name: string;
};

export const PROVIDER_CONFIGS: Record<string, ProviderDefaultConfig> = {
  siliconflow: {
    textEndpoint: 'https://api.siliconflow.cn/v1/chat/completions',
    textModel: 'Qwen/Qwen2.5-7B-Instruct',
    asrEndpoint: 'https://api.siliconflow.cn/v1/audio/transcriptions',
    asrModel: 'FunAudioLLM/SenseVoiceSmall',
    ttsEndpoint: '',
    ttsModel: '',
    speechEndpoint: 'https://api.siliconflow.cn/v1/audio/transcriptions',
    speechModel: 'FunAudioLLM/SenseVoiceSmall',
    name: '硅基流动',
  },
  sophon: {
    textEndpoint: 'https://api.sophon.cn/v1/chat/completions',
    textModel: 'sophon-chat',
    asrEndpoint: '',
    asrModel: '',
    ttsEndpoint: '',
    ttsModel: '',
    speechEndpoint: '',
    speechModel: '',
    name: '算能',
  },
  deepseek: {
    textEndpoint: 'https://api.deepseek.com/v1/chat/completions',
    textModel: 'deepseek-chat',
    asrEndpoint: '',
    asrModel: '',
    ttsEndpoint: '',
    ttsModel: '',
    speechEndpoint: '',
    speechModel: '',
    name: 'DeepSeek',
  },
  qwen: {
    textEndpoint: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
    textModel: 'qwen-turbo',
    asrEndpoint: '',
    asrModel: '',
    ttsEndpoint: '',
    ttsModel: '',
    speechEndpoint: '',
    speechModel: '',
    name: '通义千问',
  },
  openai: {
    textEndpoint: 'https://api.openai.com/v1/chat/completions',
    textModel: 'gpt-3.5-turbo',
    asrEndpoint: 'https://api.openai.com/v1/audio/transcriptions',
    asrModel: 'whisper-1',
    ttsEndpoint: 'https://api.openai.com/v1/audio/speech',
    ttsModel: 'tts-1',
    speechEndpoint: 'https://api.openai.com/v1/audio/transcriptions',
    speechModel: 'whisper-1',
    name: 'OpenAI',
  },
  volcengine: {
    textEndpoint: '',
    textModel: '',
    asrEndpoint: '',
    asrModel: '',
    ttsEndpoint: 'https://openspeech.bytedance.com/api/v1/tts',
    ttsModel: 'volcengine-tts',
    speechEndpoint: '',
    speechModel: '',
    name: '火山引擎',
  },
  oneapi: {
    textEndpoint: 'http://104.197.139.51:3000/v1/chat/completions',
    textModel: 'gemini-3-flash-preview',
    asrEndpoint: '',
    asrModel: '',
    ttsEndpoint: '',
    ttsModel: '',
    speechEndpoint: '',
    speechModel: '',
    name: 'OneAPI',
  },
  custom: {
    textEndpoint: '',
    textModel: '',
    asrEndpoint: '',
    asrModel: '',
    ttsEndpoint: '',
    ttsModel: '',
    speechEndpoint: '',
    speechModel: '',
    name: '自定义',
  },
};

export function normalizeApiServiceType(value: unknown): ApiServiceType {
  if (value === 'asr' || value === 'speech') {
    return 'asr';
  }

  if (value === 'tts') {
    return 'tts';
  }

  return 'text';
}

export function getProviderEndpoint(
  providerConfig: ProviderDefaultConfig,
  serviceType: LegacyApiServiceType
): string {
  const normalized = normalizeApiServiceType(serviceType);
  if (normalized === 'asr') {
    return providerConfig.asrEndpoint || providerConfig.speechEndpoint;
  }
  if (normalized === 'tts') {
    return providerConfig.ttsEndpoint;
  }
  return providerConfig.textEndpoint;
}

export function getProviderModel(
  providerConfig: ProviderDefaultConfig,
  serviceType: LegacyApiServiceType
): string {
  const normalized = normalizeApiServiceType(serviceType);
  if (normalized === 'asr') {
    return providerConfig.asrModel || providerConfig.speechModel;
  }
  if (normalized === 'tts') {
    return providerConfig.ttsModel;
  }
  return providerConfig.textModel;
}
