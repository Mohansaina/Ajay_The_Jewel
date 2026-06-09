import Link from "next/link";
import { getAuthenticatedUser } from "../../lib/auth-server";
import { prisma } from "../../lib/db";

// Lucide icon SVGs
const ConversationsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
);
const MessagesIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
);
const EscalationIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
);
const DocsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>
);

export default async function DashboardPage() {
  const user = await getAuthenticatedUser();
  if (!user) return null;

  // Query actual operational database stats
  const totalConversations = await prisma.conversation.count({
    where: { userId: user.id },
  });

  const totalMessages = await prisma.message.count({
    where: {
      conversation: { userId: user.id },
    },
  });

  const totalDocs = await prisma.knowledgeBaseDoc.count({
    where: { userId: user.id },
  });

  const totalEscalations = await prisma.conversation.count({
    where: {
      userId: user.id,
      status: "escalated",
    },
  });

  // Calculate escalation rate percentage
  const escalationRate = totalConversations > 0 
    ? Math.round((totalEscalations / totalConversations) * 100) 
    : 0;

  // Fetch escalated conversations queue
  const escalatedQueue = await prisma.conversation.findMany({
    where: {
      userId: user.id,
      status: "escalated",
    },
    include: {
      messages: {
        orderBy: { createdAt: "desc" },
        take: 1,
      },
    },
    orderBy: { createdAt: "desc" },
  });

  const statCards = [
    { title: "Total Chats", value: totalConversations, icon: ConversationsIcon, color: "text-blue-400" },
    { title: "AI/Visitor Messages", value: totalMessages, icon: MessagesIcon, color: "text-violet-400" },
    { title: "Knowledge Docs", value: totalDocs, icon: DocsIcon, color: "text-emerald-400" },
    { title: "Escalation Rate", value: `${escalationRate}%`, icon: EscalationIcon, color: "text-amber-400" },
  ];

  return (
    <div className="space-y-8">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800/80 pb-6">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mb-1">
            Welcome back, <span className="text-gradient font-black">{user.companyName || "Verdia Business"}</span>
          </h1>
          <p className="text-gray-400 text-sm">Here is what's happening with your live support agent today.</p>
        </div>
        <Link 
          href="/dashboard/customizer"
          className="px-4 py-2.5 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-sm transition shadow-lg shadow-indigo-600/10 glow-btn self-start md:self-auto"
        >
          Customize Widget
        </Link>
      </div>

      {/* Grid Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {statCards.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <div key={i} className="glass-panel p-6 rounded-xl relative overflow-hidden group">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-gradient-to-b from-violet-600 to-indigo-600" />
              <div className="flex justify-between items-start mb-4">
                <span className="text-gray-400 text-xs font-semibold uppercase tracking-wider">{stat.title}</span>
                <span className={`${stat.color} p-2 bg-slate-950/40 rounded-lg border border-slate-800/50`}>
                  <Icon />
                </span>
              </div>
              <h2 className="text-3xl font-bold text-white tracking-tight">{stat.value}</h2>
            </div>
          );
        })}
      </div>

      {/* Active Escalation Queue */}
      <div className="glass-panel p-6 rounded-xl">
        <div className="flex justify-between items-center mb-6">
          <div>
            <h3 className="text-lg font-bold text-white">⚠️ Pending Escalations</h3>
            <p className="text-xs text-gray-400 mt-0.5">Chats flagged as low-confidence needing business owner response.</p>
          </div>
          <span className="px-2.5 py-1 rounded bg-amber-950/40 border border-amber-900/60 text-xs text-amber-300 font-bold">
            {totalEscalations} Active
          </span>
        </div>

        {escalatedQueue.length === 0 ? (
          <div className="text-center py-12 bg-slate-950/20 border border-slate-800/30 rounded-lg flex flex-col items-center justify-center p-6">
            <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#4B5563" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-3"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
            <h4 className="text-sm font-semibold text-slate-300 mb-1">Excellent! No pending escalations</h4>
            <p className="text-xs text-slate-500 max-w-xs">Your AI chatbot is answering visitor queries successfully with high confidence.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-800 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                  <th className="pb-3">Session ID</th>
                  <th className="pb-3">Visitor Email</th>
                  <th className="pb-3">Last Query Snippet</th>
                  <th className="pb-3">Flagged At</th>
                  <th className="pb-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/50">
                {escalatedQueue.map((item) => {
                  const lastMsg = item.messages[0]?.content || "Manual Escalation triggered";
                  return (
                    <tr key={item.id} className="text-sm text-gray-300 hover:bg-slate-900/20 transition-all">
                      <td className="py-4 font-mono text-xs text-violet-400">{item.id.substring(0, 8)}...</td>
                      <td className="py-4 font-semibold text-slate-200">{item.visitorEmail || "Anonymous Visitor"}</td>
                      <td className="py-4 truncate max-w-xs text-gray-400 italic">"{lastMsg}"</td>
                      <td className="py-4 text-xs text-gray-400">{new Date(item.createdAt).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}</td>
                      <td className="py-4 text-right">
                        <Link
                          href={`/dashboard/conversations?active_id=${item.id}`}
                          className="px-3 py-1.5 rounded bg-violet-950/60 border border-violet-800/40 text-xs font-semibold text-violet-300 hover:bg-violet-900/60 transition"
                        >
                          Respond & Resolv
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
