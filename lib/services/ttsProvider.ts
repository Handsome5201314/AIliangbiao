import crypto from 'node:crypto';

import { resolveAgentApiKeyByService } from '@/lib/agent/model-resolver';
import { getAgentWorkspaceConfig } from '@/lib/agent/config';
import { getSystemApiKeyByService } from '@/lib/services/apiKeyService';

export type TtsSynthesisResult = {
  provider: string;
  model: string;
  mimeType: string;
  audioBase64: string;
};

function mimeTypeFromFormat(format: string) {
  if (format === 'wav') return 'audio/wav';
  if (format === 'ogg') return 'audio/ogg';
  return 'audio/mpeg';
}

function normalizeBase64(value: string) {
  const commaIndex = value.indexOf(',');
  return commaIndex >= 0 ? value.slice(commaIndex + 1) : value;
}

async function resolveTtsApi() {
  const preferred = await resolveAgentApiKeyByService('tts');
  if (preferred) {
    return preferred;
  }
  return getSystemApiKeyByService('tts');
}

export async function synthesizeSpeechWithProvider(input: {
  text: string;
  voiceId?: string;
  speed?: number;
  pitch?: number;
  format?: string;
}): Promise<TtsSynthesisResult> {
  const config = await getAgentWorkspaceConfig();
  if (config.voice.ttsMode === 'browser') {
    throw new Error('当前后台配置为 browser TTS，API TTS 未启用');
  }

  const api = await resolveTtsApi();
  const format = input.format || config.voice.format || 'mp3';
  const voiceId = input.voiceId || config.voice.voiceId || 'default';
  const speed = input.speed || config.voice.speed || 1;
  const pitch = input.pitch || config.voice.pitch || 1;

  const payload =
    api.provider === 'volcengine'
      ? {
          app: {
            appid: process.env.VOLCENGINE_TTS_APP_ID || 'ai-liangbiao',
            token: api.key,
            cluster: process.env.VOLCENGINE_TTS_CLUSTER || 'volcano_tts',
          },
          user: {
            uid: 'ai-liangbiao-parent-voice',
          },
          audio: {
            voice_type: voiceId,
            encoding: format,
            speed_ratio: speed,
            pitch_ratio: pitch,
          },
          request: {
            reqid: crypto.randomUUID(),
            text: input.text,
            operation: 'query',
          },
        }
      : {
          model: api.model,
          input: input.text,
          voice: voiceId,
          response_format: format,
          speed,
        };

  const response = await fetch(api.endpoint, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${api.key}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => '');
    throw new Error(`TTS provider request failed: ${response.status} ${response.statusText} ${errorText}`.trim());
  }

  const contentType = response.headers.get('content-type') || '';
  if (/^audio\//i.test(contentType)) {
    const audioBuffer = Buffer.from(await response.arrayBuffer());
    return {
      provider: api.provider,
      model: api.model,
      mimeType: contentType,
      audioBase64: audioBuffer.toString('base64'),
    };
  }

  const data = await response.json().catch(() => null) as Record<string, unknown> | null;
  const base64Audio =
    typeof data?.data === 'string'
      ? data.data
      : typeof data?.audio === 'string'
        ? data.audio
        : typeof data?.audioBase64 === 'string'
          ? data.audioBase64
          : '';

  if (!base64Audio) {
    throw new Error('TTS provider returned no audio payload');
  }

  return {
    provider: api.provider,
    model: api.model,
    mimeType: mimeTypeFromFormat(format),
    audioBase64: normalizeBase64(base64Audio),
  };
}
