"use server";

import crypto from "crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { prisma } from "../../lib/db";
import { signToken } from "../../lib/jwt";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-nextjs-chatbot-widget-key-value-12345";

// Password SHA256 hashing matching Python seed_user.py
const hashPassword = (password: string): string => {
  return crypto.createHash("sha256").update(password).digest("hex");
};

// Generates raw live API keys
const generateApiKey = (): string => {
  return `sk_live_${crypto.randomBytes(16).toString("hex")}`;
};

export async function loginAction(prevState: any, formData: FormData) {
  const email = formData.get("email") as string;
  const password = formData.get("password") as string;

  if (!email || !password) {
    return { error: "Email and password are required." };
  }

  try {
    const hashed = hashPassword(password);
    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || user.passwordHash !== hashed) {
      return { error: "Invalid email or password." };
    }

    // Sign JWT
    const token = signToken({ userId: user.id }, JWT_SECRET);

    // Set cookie
    cookies().set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

  } catch (err: any) {
    console.error("Login Action Error:", err);
    return { error: "An unexpected error occurred. Please try again." };
  }

  // Redirect on success
  redirect("/dashboard");
}

export async function registerAction(prevState: any, formData: FormData) {
  const email = formData.get("email") as string;
  const companyName = formData.get("companyName") as string;
  const password = formData.get("password") as string;
  const confirmPassword = formData.get("confirmPassword") as string;

  if (!email || !companyName || !password || !confirmPassword) {
    return { error: "All fields are required." };
  }

  if (password !== confirmPassword) {
    return { error: "Passwords do not match." };
  }

  if (password.length < 6) {
    return { error: "Password must be at least 6 characters." };
  }

  try {
    // Check if user already exists
    const existing = await prisma.user.findUnique({
      where: { email },
    });

    if (existing) {
      return { error: "An account with this email already exists." };
    }

    const hashed = hashPassword(password);

    // Create user along with default settings and initial API Key in a transaction
    const newUser = await prisma.$transaction(async (tx) => {
      const u = await tx.user.create({
        data: {
          email,
          passwordHash: hashed,
          companyName,
        },
      });

      // Default widget settings
      await tx.widgetSettings.create({
        data: {
          userId: u.id,
          brandColor: "#2563EB",
          welcomeMessage: "Hi there! Ask me anything about our services.",
          position: "bottom-right",
          escalationEmail: email,
          escalationSubjectPrefix: "[AI Chatbot Escalation]",
          emailCaptureRequired: false,
          confidenceThreshold: 0.7,
        },
      });

      // Default Live API key
      const rawKey = generateApiKey();
      const hashedKey = crypto.createHash("sha256").update(rawKey).digest("hex");
      await tx.aPIKey.create({
        data: {
          userId: u.id,
          keyHash: hashedKey,
          name: "Initial Web Embed Key",
          active: true,
        },
      });

      return u;
    });

    // Sign JWT
    const token = signToken({ userId: newUser.id }, JWT_SECRET);

    // Set cookie
    cookies().set("auth_token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: "/",
    });

  } catch (err: any) {
    console.error("Register Action Error:", err);
    return { error: "Registration failed. Please try again." };
  }

  // Redirect to onboarding
  redirect("/dashboard/onboarding");
}

export async function logoutAction() {
  cookies().set("auth_token", "", {
    httpOnly: true,
    expires: new Date(0),
    path: "/",
  });
  redirect("/login");
}
