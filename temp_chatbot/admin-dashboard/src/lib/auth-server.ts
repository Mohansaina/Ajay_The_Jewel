import { cookies } from "next/headers";
import { verifyToken } from "./jwt";
import { prisma } from "./db";

const JWT_SECRET = process.env.JWT_SECRET || "super-secret-nextjs-chatbot-widget-key-value-12345";

export interface AuthenticatedUser {
  id: string;
  email: string;
  companyName: string | null;
  createdAt: Date;
}

export const getAuthenticatedUser = async (): Promise<AuthenticatedUser | null> => {
  try {
    const cookieStore = cookies();
    const token = cookieStore.get("auth_token")?.value;

    if (!token) return null;

    const payload = verifyToken(token, JWT_SECRET);
    if (!payload || !payload.userId) return null;

    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: {
        id: true,
        email: true,
        companyName: true,
        createdAt: true,
      },
    });

    return user;
  } catch (err) {
    return null;
  }
};
