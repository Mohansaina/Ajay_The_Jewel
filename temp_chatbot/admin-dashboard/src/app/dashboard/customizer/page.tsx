import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "../../../lib/auth-server";
import { prisma } from "../../../lib/db";
import CustomizerClient from "./CustomizerClient";

export default async function CustomizerPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login");
  }

  // Fetch the user's widget settings
  let settings = await prisma.widgetSettings.findUnique({
    where: {
      userId: user.id,
    },
  });

  if (!settings) {
    // Create fallback default settings if not exists
    settings = await prisma.widgetSettings.create({
      data: {
        userId: user.id,
        brandColor: "#2563EB",
        welcomeMessage: "Hello! How can I help you today?",
        position: "bottom-right",
        escalationEmail: user.email,
        escalationSubjectPrefix: "[AI Chatbot Escalation]",
        emailCaptureRequired: false,
        confidenceThreshold: 0.7,
      },
    });
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-slate-800/80 pb-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-white mb-1">Widget Customizer</h1>
        <p className="text-gray-400 text-sm">
          Design your white-label chatbot look and feel, and see edits live.
        </p>
      </div>

      {/* Mounting Customizer Client Workspace */}
      <CustomizerClient
        initialSettings={{
          brandColor: settings.brandColor,
          welcomeMessage: settings.welcomeMessage,
          position: settings.position,
          escalationEmail: settings.escalationEmail,
          escalationSubjectPrefix: settings.escalationSubjectPrefix,
          emailCaptureRequired: settings.emailCaptureRequired,
          confidenceThreshold: settings.confidenceThreshold,
        }}
      />
    </div>
  );
}
