'use client';

import DoctorBotChatExperience from '@/components/DoctorBotChatExperience';
import ResponsiveAgentWorkspace from '@/components/ResponsiveAgentWorkspace';

type ConversationShellProps = {
  mode: 'self_service' | 'doctor_bot' | 'public_share';
  slug?: string;
};

export default function ConversationShell({ mode, slug }: ConversationShellProps) {
  if (mode === 'doctor_bot') {
    return <DoctorBotChatExperience slugOverride={slug} showBackToHall />;
  }

  if (mode === 'public_share') {
    return <DoctorBotChatExperience slugOverride={slug} />;
  }

  return <ResponsiveAgentWorkspace />;
}
