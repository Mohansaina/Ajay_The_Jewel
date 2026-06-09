import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "../../../lib/auth-server";
import { prisma } from "../../../lib/db";
import APIKeysClient from "./APIKeysClient";

export default async function APIKeysPage() {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login");
  }

  // Fetch all API Key records linked to this owner
  const keys = await prisma.aPIKey.findMany({
    where: {
      userId: user.id,
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-slate-800/80 pb-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-white mb-1">API Keys & Integration</h1>
        <p className="text-gray-400 text-sm">
          Generate live keys and grab copyable code snippets to deploy the widget across your platforms.
        </p>
      </div>

      {/* Rendering client API keys page */}
      <APIKeysClient
        initialKeys={keys.map((k) => ({
          id: k.id,
          name: k.name,
          active: k.active,
          createdAt: k.createdAt.toISOString(),
          // We mask the prefix for security in normal listings
          prefix: "sk_live_••••" + k.keyHash.substring(0, 4),
        }))}
      />
    </div>
  );
}
