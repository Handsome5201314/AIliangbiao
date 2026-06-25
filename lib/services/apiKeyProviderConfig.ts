export type ApiServiceType = 'text' | 'speech';

type ProviderDefaultConfig = {
  textEndpoint: string;
  textModel: string;
  speechEndpoint: string;
  speechModel: string;
  name: string;
};

export const PROVIDER_CONFIGS: Record<string, ProviderDefaultConfig> = {
  siliconflow: {
    textEndpoint: 'https://api.siliconflow.cn/v1/chat/completions',
    textModel: 'Qwen/Qwen2.5-7B-Instruct',
    speechEndpoint: 'https://api.siliconflow.cn/v1/audio/transcriptions',
    speechModel: 'FunAudioLLM/SenseVoiceSmall',
    name: '硅基流动',
  },
  sophon: {
    textEndpoint: 'https://api.sophon.cn/v1/chat/completions',
    textModel: 'sophon-chat',
    speechEndpoint: '',
    speechModel: '',
    name: '算能',
  },
  deepseek: {
    textEndpoint: 'https://api.deepseek.com/v1/chat/completions',
    textModel: 'deepseek-chat',
    speechEndpoint: '',
    speechModel: '',
    name: 'DeepSeek',
  },
  qwen: {
    textEndpoint: 'https://dashscope.aliyuncs.com/api/v1/services/aigc/text-generation/generation',
    textModel: 'qwen-turbo',
    speechEndpoint: '',
    speechModel: '',
    name: '通义千问',
  },
  openai: {
    textEndpoint: 'https://api.openai.com/v1/chat/completions',
    textModel: 'gpt-3.5-turbo',
    speechEndpoint: 'https://api.openai.com/v1/audio/transcriptions',
    speechModel: 'whisper-1',
    name: 'OpenAI',
  },
  oneapi: {
    textEndpoint: 'http://104.197.139.51:3000/v1/chat/completions',
    textModel: 'gemini-3-flash-preview',
    speechEndpoint: '',
    speechModel: '',
    name: 'OneAPI',
  },
  custom: {
    textEndpoint: '',
    textModel: '',
    speechEndpoint: '',
    speechModel: '',
    name: '自定义',
  },
};
