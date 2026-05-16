import type { LanguageCode, LocalizedTextValue, ScaleOption, ScaleQuestion, ScaleSymptomOption } from "./types";

const symptomOptionFallbackLabels: Record<string, { zh: string; en: string }> = {
  dizziness: { zh: "头晕", en: "Dizziness" },
  head_distension: { zh: "头胀", en: "Head distension" },
  head_heaviness: { zh: "头重", en: "Head heaviness" },
  headache: { zh: "头痛", en: "Headache" },
  vertigo: { zh: "眩晕", en: "Vertigo" },
  syncope: { zh: "晕厥", en: "Syncope" },
  tinnitus: { zh: "耳鸣", en: "Tinnitus" },
  sleep_onset: { zh: "入睡困难", en: "Sleep onset difficulty" },
  light_sleep: { zh: "浅睡易醒", en: "Light sleep" },
  dreaming: { zh: "多梦", en: "Dreaming" },
  nightmare: { zh: "噩梦", en: "Nightmare" },
  early_waking: { zh: "早醒", en: "Early waking" },
  insomnia: { zh: "失眠", en: "Insomnia" },
  hypersomnia: { zh: "睡眠过多", en: "Hypersomnia" },
  fatigue: { zh: "疲劳", en: "Fatigue" },
  weakness: { zh: "乏力", en: "Weakness" },
  mobility_difficulty: { zh: "行动困难", en: "Mobility difficulty" },
  low_energy: { zh: "精力减退", en: "Low energy" },
  loss_of_interest: { zh: "兴趣减退", en: "Loss of interest" },
  low_mood: { zh: "情绪低落", en: "Low mood" },
  irritability: { zh: "烦躁", en: "Irritability" },
  impatience: { zh: "缺乏耐心", en: "Impatience" },
  palpitations: { zh: "心慌", en: "Palpitations" },
  chest_tightness: { zh: "胸闷", en: "Chest tightness" },
  chest_pain: { zh: "胸痛", en: "Chest pain" },
  shortness_of_breath: { zh: "气短", en: "Shortness of breath" },
  anxiety_tension: { zh: "焦虑紧张", en: "Anxiety and tension" },
  worry_fear: { zh: "担心害怕", en: "Worry and fear" },
  panic: { zh: "惊恐", en: "Panic" },
  sense_of_dying: { zh: "濒死感", en: "Sense of dying" },
  loss_of_control: { zh: "失控感", en: "Loss of control" },
  over_worrying: { zh: "过度操心", en: "Over-worrying" },
  overthinking: { zh: "想太多", en: "Overthinking" },
  rumination: { zh: "反复纠结", en: "Rumination" },
  catastrophizing: { zh: "灾难化联想", en: "Catastrophizing" },
  poor_attention: { zh: "注意力差", en: "Poor attention" },
  slow_thinking: { zh: "思考变慢", en: "Slow thinking" },
  forgetfulness: { zh: "健忘", en: "Forgetfulness" },
  sluggishness: { zh: "迟钝", en: "Sluggishness" },
  trance: { zh: "发愣", en: "Trance" },
  bloating: { zh: "腹胀", en: "Bloating" },
  stomach_pain: { zh: "胃痛", en: "Stomach pain" },
  acid_reflux: { zh: "反酸", en: "Acid reflux" },
  poor_appetite: { zh: "食欲差", en: "Poor appetite" },
  constipation: { zh: "便秘", en: "Constipation" },
  frequent_bowel_movements: { zh: "便多", en: "Frequent bowel movements" },
  hiccups: { zh: "打嗝", en: "Hiccups" },
  bitter_dry_mouth: { zh: "口干口苦", en: "Dry or bitter mouth" },
  nausea: { zh: "恶心", en: "Nausea" },
  weight_loss: { zh: "消瘦", en: "Weight loss" },
  neck_pain: { zh: "颈部疼痛", en: "Neck pain" },
  shoulder_pain: { zh: "肩部疼痛", en: "Shoulder pain" },
  waist_pain: { zh: "腰部疼痛", en: "Waist pain" },
  back_pain: { zh: "背部疼痛", en: "Back pain" },
  leg_pain: { zh: "腿部疼痛", en: "Leg pain" },
  other_pain: { zh: "其他疼痛", en: "Other pain" },
  sensitivity: { zh: "敏感", en: "Sensitivity" },
  dependence: { zh: "依赖", en: "Dependence" },
  sadness: { zh: "伤感", en: "Sadness" },
  crying: { zh: "哭泣", en: "Crying" },
  numbness: { zh: "麻木", en: "Numbness" },
  stiffness: { zh: "僵硬", en: "Stiffness" },
  twitching: { zh: "抽动", en: "Twitching" },
  tremor: { zh: "震颤", en: "Tremor" },
  stinging_pain: { zh: "刺痛", en: "Stinging pain" },
  cold_intolerance: { zh: "怕冷", en: "Cold intolerance" },
  blurred_vision: { zh: "视物模糊", en: "Blurred vision" },
  dry_eyes: { zh: "眼睛干涩", en: "Dry eyes" },
  eye_pain_pressure: { zh: "眼胀眼痛", en: "Eye pain or pressure" },
  vision_decline: { zh: "视力下降", en: "Vision decline" },
  agitation: { zh: "激动", en: "Agitation" },
  anger_irritability: { zh: "易怒", en: "Anger and irritability" },
  sound_sensitivity: { zh: "声音敏感", en: "Sound sensitivity" },
  startle_response: { zh: "易受惊吓", en: "Startle response" },
  perfectionism: { zh: "追求完美", en: "Perfectionism" },
  cleanliness_obsession: { zh: "洁癖", en: "Cleanliness obsession" },
  obsessive_thoughts: { zh: "强迫思维", en: "Obsessive thoughts" },
  compulsive_behaviors: { zh: "强迫行为", en: "Compulsive behaviors" },
  skin_allergy: { zh: "皮肤过敏", en: "Skin allergy" },
  itching: { zh: "瘙痒", en: "Itching" },
  rash: { zh: "皮疹", en: "Rash" },
  flushing: { zh: "潮红", en: "Flushing" },
  hot_flush: { zh: "潮热", en: "Hot flush" },
  sweating: { zh: "多汗", en: "Sweating" },
  health_preoccupation: { zh: "过度关注健康", en: "Health preoccupation" },
  fear_self_illness: { zh: "担心自己生病", en: "Fear of self illness" },
  fear_family_illness: { zh: "担心家人生病", en: "Fear of family illness" },
  breathing_difficulty: { zh: "呼吸困难", en: "Breathing difficulty" },
  chest_pressure: { zh: "憋闷", en: "Chest pressure" },
  suffocation: { zh: "窒息感", en: "Suffocation" },
  sighing: { zh: "爱叹气", en: "Sighing" },
  cough: { zh: "咳嗽", en: "Cough" },
  rib_pain: { zh: "肋部痛", en: "Rib pain" },
  throat_discomfort: { zh: "咽部不适", en: "Throat discomfort" },
  throat_blockage: { zh: "咽部堵塞感", en: "Throat blockage" },
  nasal_dryness: { zh: "鼻腔干涩", en: "Nasal dryness" },
  nasal_congestion: { zh: "鼻塞", en: "Nasal congestion" },
  ear_fullness: { zh: "耳胀", en: "Ear fullness" },
  frequent_urination: { zh: "尿频", en: "Frequent urination" },
  urgency: { zh: "尿急", en: "Urgency" },
  painful_urination: { zh: "尿痛", en: "Painful urination" },
  perineal_discomfort: { zh: "会阴不适", en: "Perineal discomfort" },
  sexual_decline: { zh: "性功能下降", en: "Sexual decline" },
};

function humanizeSymptomId(id: string) {
  return id
    .split("_")
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function resolveLocalizedText(
  value: LocalizedTextValue | undefined,
  language: LanguageCode = "zh"
): string {
  if (!value) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  return value[language] ?? value.zh ?? value.en ?? "";
}

export function resolveQuestionText(
  question: Pick<ScaleQuestion, "text">,
  language: LanguageCode = "zh"
): string {
  return resolveLocalizedText(question.text, language);
}

export function resolveQuestionColloquial(
  question: Pick<ScaleQuestion, "colloquial" | "text">,
  language: LanguageCode = "zh"
): string {
  return resolveLocalizedText(question.colloquial, language) || resolveLocalizedText(question.text, language);
}

export function resolveQuestionVoicePrompt(
  question: Pick<ScaleQuestion, "voicePrompt" | "colloquial" | "text">,
  language: LanguageCode = "zh"
): string {
  return (
    resolveLocalizedText(question.voicePrompt, language) ||
    resolveLocalizedText(question.colloquial, language) ||
    resolveLocalizedText(question.text, language)
  );
}

export function resolveQuestionSimpleExplain(
  question: Pick<ScaleQuestion, "simpleExplain" | "fallback_examples" | "colloquial" | "text">,
  language: LanguageCode = "zh"
): string {
  return (
    resolveLocalizedText(question.simpleExplain, language) ||
    resolveLocalizedText(question.fallback_examples?.[0], language) ||
    resolveLocalizedText(question.colloquial, language) ||
    resolveLocalizedText(question.text, language)
  );
}

export function resolveQuestionConfirmationPrompt(
  question: Pick<ScaleQuestion, "confirmationPrompt" | "colloquial" | "text">,
  language: LanguageCode = "zh"
): string {
  return (
    resolveLocalizedText(question.confirmationPrompt, language) ||
    resolveLocalizedText(question.colloquial, language) ||
    resolveLocalizedText(question.text, language)
  );
}

export function resolveFallbackExamples(
  question: Pick<ScaleQuestion, "fallback_examples">,
  language: LanguageCode = "zh"
): string[] {
  return question.fallback_examples.map((item) => resolveLocalizedText(item, language)).filter(Boolean);
}

export function resolveOptionDescription(
  option: Pick<ScaleOption, "description">,
  language: LanguageCode = "zh"
): string {
  return resolveLocalizedText(option.description, language);
}

export function resolveSymptomOptionLabel(
  option: Pick<ScaleSymptomOption, "id" | "label">,
  language: LanguageCode = "zh"
): string {
  const raw = resolveLocalizedText(option.label, language);
  if (raw && !/^\?+$/.test(raw.trim())) {
    return raw;
  }

  const fallback = symptomOptionFallbackLabels[option.id];
  if (fallback) {
    return language === "en" ? fallback.en : fallback.zh;
  }

  return humanizeSymptomId(option.id);
}
