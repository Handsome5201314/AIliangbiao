import type { RealtimeSurface } from "@/lib/realtime/config";

export type RealtimeToolDescriptor = {
  name: string;
  riskLevel: "low" | "medium" | "high";
  requiresDoctor?: boolean;
  surfaces: RealtimeSurface[];
};

const TOOL_CATALOG: RealtimeToolDescriptor[] = [
  { name: "context.read_member", riskLevel: "low", surfaces: ["agent", "doctor_bot"] },
  { name: "assessment.recommend", riskLevel: "low", surfaces: ["agent", "doctor_bot"] },
  { name: "assessment.start", riskLevel: "low", surfaces: ["agent", "doctor_bot"] },
  { name: "assessment.resume", riskLevel: "low", surfaces: ["agent", "doctor_bot"] },
  { name: "assessment.answer", riskLevel: "low", surfaces: ["agent", "doctor_bot"] },
  { name: "assessment.end", riskLevel: "medium", surfaces: ["agent", "doctor_bot"] },
  { name: "assessment.summary.read", riskLevel: "low", surfaces: ["agent", "doctor_bot"] },
  { name: "doctor.knowledge.answer", riskLevel: "medium", surfaces: ["doctor_bot"] },
  { name: "doctor.invite.create", riskLevel: "high", requiresDoctor: true, surfaces: ["agent"] },
  { name: "doctor.triage.redirect", riskLevel: "medium", requiresDoctor: true, surfaces: ["agent", "doctor_bot"] },
  { name: "handoff.escalate", riskLevel: "medium", surfaces: ["agent", "doctor_bot"] },
];

export function listRealtimeToolDescriptors(input: {
  surface: RealtimeSurface;
  accountType?: "PATIENT" | "DOCTOR";
  doctorProfileId?: string | null;
}) {
  return TOOL_CATALOG.filter((tool) => {
    if (!tool.surfaces.includes(input.surface)) {
      return false;
    }

    if (!tool.requiresDoctor) {
      return true;
    }

    return input.accountType === "DOCTOR" && Boolean(input.doctorProfileId);
  });
}
