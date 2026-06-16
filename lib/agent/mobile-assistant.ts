export const MOBILE_ASSISTANT_STAGES = [
  "collapsed",
  "half",
  "full",
] as const;

export type MobileAssistantStage = (typeof MOBILE_ASSISTANT_STAGES)[number];
export type MobileAssistantAction = "open" | "expand" | "collapse" | "close";
export type AssistantTab = "chat" | "explanation" | "history";

export function resolveMobileAssistantStage(
  current: MobileAssistantStage,
  action: MobileAssistantAction
): MobileAssistantStage {
  switch (action) {
    case "open":
      return current === "full" ? "full" : "half";
    case "expand":
      return "full";
    case "collapse":
      return current === "full" ? "half" : "collapsed";
    case "close":
      return "collapsed";
    default:
      return current;
  }
}

export function isMobileAssistantOpen(stage: MobileAssistantStage) {
  return stage !== "collapsed";
}
