"use server";

import crypto from "crypto";
import { revalidatePath } from "next/cache";
import { getAuthenticatedUser } from "../../lib/auth-server";
import { prisma } from "../../lib/db";

export async function createApiKeyAction(name: string) {
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized access." };

  if (!name.trim()) return { error: "API Key name is required." };

  try {
    const rawKey = `sk_live_${crypto.randomBytes(16).toString("hex")}`;
    const hashedKey = crypto.createHash("sha256").update(rawKey).digest("hex");

    await prisma.aPIKey.create({
      data: {
        userId: user.id,
        keyHash: hashedKey,
        name: name.trim(),
        active: true,
      },
    });

    revalidatePath("/dashboard/api-keys");
    return { success: true, key: rawKey };
  } catch (err: any) {
    console.error("Create API Key Error:", err);
    return { error: "Failed to generate API Key." };
  }
}

export async function revokeApiKeyAction(id: string) {
  const user = await getAuthenticatedUser();
  if (!user) return { error: "Unauthorized access." };

  try {
    await prisma.aPIKey.delete({
      where: {
        id,
        userId: user.id,
      },
    });

    revalidatePath("/dashboard/api-keys");
    return { success: true };
  } catch (err: any) {
    console.error("Revoke API Key Error:", err);
    return { error: "Failed to revoke API Key." };
  }
}
