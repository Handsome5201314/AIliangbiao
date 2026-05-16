import { getPublishedDoctorBotBySlug } from "@/lib/services/doctor-bot";

export async function createDoctorBotBootstrapState(input: {
  slug: string;
  deviceId: string;
}) {
  const bot = await getPublishedDoctorBotBySlug(input.slug);

  return {
    surface: "doctor_bot" as const,
    deviceId: input.deviceId,
    slug: input.slug,
    bot: bot.publicInfo,
    enabledScales: bot.enabledScales.map((scale) => ({
      id: scale.id,
      title: scale.title,
      interactionMode: scale.interactionMode || "manual_only",
      resultDeliveryMode: scale.resultDeliveryMode || "immediate",
    })),
  };
}
