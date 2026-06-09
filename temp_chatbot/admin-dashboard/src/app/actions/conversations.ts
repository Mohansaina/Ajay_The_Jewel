"use server";

import { revalidatePath } from "next/cache";
import { getAuthenticatedUser } from "../../lib/auth-server";
import { prisma } from "../../lib/db";

export async function replyToConversationAction(convId: string, content: string) {
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized access." };

  if (!content.trim()) return { error: "Reply message cannot be empty." };

  try {
    // 1. Create the owner response message
    await prisma.message.create({
      data: {
        conversationId: convId,
        sender: "owner",
        content: content.trim(),
      },
    });

    // 2. Set conversation status back to 'active' or keep resolved (since owner answered, it resolves escalation status!)
    await prisma.conversation.update({
      where: { id: convId },
      data: {
        status: "active",
      },
    });

    revalidatePath("/dashboard/conversations");
    return { success: true };
  } catch (err: any) {
    console.error("Reply To Conversation Error:", err);
    return { error: "Failed to post message." };
  }
}

export async function resolveConversationAction(convId: string) {
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized access." };

  try {
    await prisma.conversation.update({
      where: { id: convId },
      data: {
        status: "resolved",
      },
    });

    revalidatePath("/dashboard/conversations");
    return { success: true };
  } catch (err: any) {
    console.error("Resolve Conversation Error:", err);
    return { error: "Failed to resolve conversation." };
  }
}
