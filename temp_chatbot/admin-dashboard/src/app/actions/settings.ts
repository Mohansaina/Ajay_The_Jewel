"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedUser } from "../../lib/auth-server";
import { prisma } from "../../lib/db";

export interface SettingsInput {
  brandColor: string;
  welcomeMessage: string;
  position: string;
  escalationEmail: string;
  escalationSubjectPrefix: string;
  emailCaptureRequired: boolean;
  confidenceThreshold: number;
}

export async function updateSettingsAction(data: SettingsInput) {
  const user = await getAuthenticatedUser();
  if (!user) {
    return { error: "Unauthorized access." };
  }

  try {
    await prisma.widgetSettings.update({
      where: {
        userId: user.id,
      },
      data: {
        brandColor: data.brandColor,
        welcomeMessage: data.welcomeMessage,
        position: data.position,
        escalationEmail: data.escalationEmail,
        escalationSubjectPrefix: data.escalationSubjectPrefix,
        emailCaptureRequired: data.emailCaptureRequired,
        confidenceThreshold: data.confidenceThreshold,
      },
    });

    revalidatePath("/dashboard/customizer");
    return { success: true };
  } catch (err: any) {
    console.error("Update Settings Action Error:", err);
    return { error: "Failed to save settings. Please try again." };
  }
}
