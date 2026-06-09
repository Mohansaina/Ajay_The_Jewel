import { redirect } from "next/navigation";
import { getAuthenticatedUser } from "../../../lib/auth-server";
import { prisma } from "../../../lib/db";
import ConversationsClient from "./ConversationsClient";

interface PageProps {
  searchParams: {
    active_id?: string;
  };
}

export default async function ConversationsPage({ searchParams }: PageProps) {
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login");
  }

  const activeId = searchParams.active_id || "";

  // Fetch all conversation records linked to this owner
  const conversations = await prisma.conversation.findMany({
    where: {
      userId: user.id,
    },
    include: {
      messages: {
        orderBy: {
          createdAt: "asc",
        },
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-slate-800/80 pb-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-white mb-1">Conversations Log</h1>
        <p className="text-gray-400 text-sm">
          Inspect visitor session chat histories and step in as a human responder.
        </p>
      </div>

      {/* Rendering client conversations layout */}
      <ConversationsClient
        initialConversations={conversations.map((conv) => ({
          id: conv.id,
          visitorEmail: conv.visitorEmail || "Anonymous Visitor",
          status: conv.status,
          createdAt: conv.createdAt.toISOString(),
          messages: conv.messages.map((m) => ({
            id: m.id,
            sender: m.sender,
            content: m.content,
            createdAt: m.createdAt.toISOString(),
          })),
        }))}
        activeId={activeId}
      />
    </div>
  );
}
