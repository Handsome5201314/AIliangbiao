import { prisma } from "@/lib/db/prisma";

export type RealtimeSurface = "agent" | "doctor_bot";

export type RealtimeRuntimeConfig = {
  provider: "hermes";
  mode: "sdk";
  allowedSurfaces: RealtimeSurface[];
  fallbacks: {
    voiceIntent: boolean;
    speechToText: boolean;
    doctorBot: boolean;
  };
};

const DEFAULT_REALTIME_RUNTIME_CONFIG: RealtimeRuntimeConfig = {
  provider: "hermes",
  mode: "sdk",
  allowedSurfaces: ["agent", "doctor_bot"],
  fallbacks: {
    voiceIntent: true,
    speechToText: true,
    doctorBot: true,
  },
};

const REALTIME_RUNTIME_CONFIG_KEY = "realtimeRuntimeConfig";

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepMerge<T>(base: T, override: unknown): T {
  if (!isPlainObject(base) || !isPlainObject(override)) {
    return (override ?? base) as T;
  }

  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const existing = result[key];
    result[key] = isPlainObject(existing) && isPlainObject(value) ? deepMerge(existing, value) : value;
  }
  return result as T;
}

function normalizeStoredJson(value?: string | null) {
  if (!value) {
    return null;
  }

  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

export async function getRealtimeRuntimeConfig(): Promise<RealtimeRuntimeConfig> {
  const stored = await prisma.systemConfig.findUnique({
    where: { configKey: REALTIME_RUNTIME_CONFIG_KEY },
  });

  return deepMerge(DEFAULT_REALTIME_RUNTIME_CONFIG, normalizeStoredJson(stored?.configValue) || {});
}

export { DEFAULT_REALTIME_RUNTIME_CONFIG };
