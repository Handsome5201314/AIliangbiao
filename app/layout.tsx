import type { Metadata } from "next";
import "./globals.css";
import "./globals.print.css";
import "@/lib/polyfills/crypto"; // crypto.randomUUID polyfill
import { AssessmentProvider } from "@/contexts/AssessmentContext";
import { ConversationHistoryProvider } from "@/contexts/ConversationHistoryContext";
import { AuthSessionProvider } from "@/contexts/AuthSessionContext";
import { ProfileProvider } from "@/contexts/ProfileContext";
import { SkillSessionProvider } from "@/contexts/SkillSessionContext";

export const metadata: Metadata = {
  title: "AI量表系统 - 智能心理评估平台",
  description: "基于 MCP 协议的 AI 驱动临床量表评估系统",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN" suppressHydrationWarning>
      <body className="min-h-screen bg-background font-sans antialiased">
        <AuthSessionProvider>
          <ProfileProvider>
            <SkillSessionProvider>
              <ConversationHistoryProvider>
                <AssessmentProvider>
                  {children}
                </AssessmentProvider>
              </ConversationHistoryProvider>
            </SkillSessionProvider>
          </ProfileProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
