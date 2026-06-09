"use client";

import { useState, useEffect, useRef } from "react";
import { replyToConversationAction, resolveConversationAction } from "../../actions/conversations";

export interface MessageItem {
  id: string;
  sender: string; // visitor, assistant, owner
  content: string;
  createdAt: string;
}

export interface ConversationItem {
  id: string;
  visitorEmail: string;
  status: string; // active, escalated, resolved
  createdAt: string;
  messages: MessageItem[];
}

interface ConversationsClientProps {
  initialConversations: ConversationItem[];
  activeId: string;
}

export default function ConversationsClient({
  initialConversations,
  activeId,
}: ConversationsClientProps) {
  const [conversations, setConversations] = useState<ConversationItem[]>(initialConversations);
  const [selectedId, setSelectedId] = useState<string>(activeId || (initialConversations[0]?.id ?? ""));
  const [replyInput, setReplyInput] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const selectedConv = conversations.find((c) => c.id === selectedId);

  // Auto scroll to bottom of active conversation transcript
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [selectedConv?.messages.length, selectedId]);

  // Sync activeId from props (e.g. from Dashboard click redirects)
  useEffect(() => {
    if (activeId) {
      setSelectedId(activeId);
    }
  }, [activeId]);

  const handleReplySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const text = replyInput.trim();
    if (!text || !selectedId || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await replyToConversationAction(selectedId, text);
      if (res.success) {
        setReplyInput("");
        // Optimistic update of UI state
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id === selectedId) {
              return {
                ...c,
                status: "active", // Flips back to active
                messages: [
                  ...c.messages,
                  {
                    id: crypto.randomUUID(),
                    sender: "owner",
                    content: text,
                    createdAt: new Date().toISOString(),
                  },
                ],
              };
            }
            return c;
          })
        );
      } else {
        alert(res.error || "Failed to post message.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error posting reply.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResolve = async () => {
    if (!selectedId || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const res = await resolveConversationAction(selectedId);
      if (res.success) {
        setConversations((prev) =>
          prev.map((c) => {
            if (c.id === selectedId) {
              return { ...c, status: "resolved" };
            }
            return c;
          })
        );
      } else {
        alert(res.error || "Failed to resolve conversation.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error resolving conversation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 h-[calc(100vh-220px)] items-stretch">
      {/* Sidebar List (Left Panel - Span 4) */}
      <div className="lg:col-span-4 glass-panel rounded-xl overflow-hidden flex flex-col h-full">
        <div className="p-4 border-b border-slate-800/80 bg-slate-950/20">
          <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Conversation Logs</span>
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-slate-800/50">
          {conversations.length === 0 ? (
            <div className="p-8 text-center text-xs text-gray-500">No active threads yet.</div>
          ) : (
            conversations.map((conv) => {
              const isActive = conv.id === selectedId;
              const lastMsg = conv.messages[conv.messages.length - 1]?.content || "No messages";
              return (
                <button
                  key={conv.id}
                  onClick={() => setSelectedId(conv.id)}
                  className={`w-full text-left p-4 transition-all flex flex-col gap-2 hover:bg-slate-900/10 ${
                    isActive ? "bg-violet-950/20 border-l-2 border-violet-500" : ""
                  }`}
                >
                  <div className="flex justify-between items-center w-full">
                    <span className="text-xs font-bold text-slate-200 truncate max-w-[150px]" title={conv.visitorEmail}>
                      {conv.visitorEmail}
                    </span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[8px] uppercase font-black tracking-wider ${
                        conv.status === "escalated"
                          ? "bg-amber-950/40 border border-amber-900/60 text-amber-300 animate-pulse"
                          : conv.status === "resolved"
                          ? "bg-slate-900 border border-slate-800 text-slate-400"
                          : "bg-blue-950/40 border border-blue-900/60 text-blue-400"
                      }`}
                    >
                      {conv.status}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 truncate w-full italic">"{lastMsg}"</p>
                  <span className="text-[9px] text-gray-500 self-end">
                    {new Date(conv.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* Thread Inspector (Right Panel - Span 8) */}
      <div className="lg:col-span-8 glass-panel rounded-xl overflow-hidden flex flex-col h-full relative bg-slate-950/10">
        {selectedConv ? (
          <>
            {/* Inspector Header */}
            <div className="p-4 border-b border-slate-800/80 bg-slate-950/40 flex justify-between items-center">
              <div>
                <h4 className="text-xs font-bold text-white">{selectedConv.visitorEmail}</h4>
                <p className="text-[9px] text-gray-500 font-mono mt-0.5">Session ID: {selectedConv.id}</p>
              </div>

              <div className="flex items-center gap-3">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                    selectedConv.status === "escalated"
                      ? "bg-amber-950/40 border border-amber-900/60 text-amber-300 animate-pulse"
                      : selectedConv.status === "resolved"
                      ? "bg-slate-900 border border-slate-800 text-slate-400"
                      : "bg-blue-950/40 border border-blue-900/60 text-blue-400"
                  }`}
                >
                  {selectedConv.status}
                </span>

                {selectedConv.status !== "resolved" && (
                  <button
                    onClick={handleResolve}
                    disabled={isSubmitting}
                    className="px-2.5 py-1 bg-emerald-950/60 border border-emerald-800/40 hover:bg-emerald-900/60 text-emerald-300 font-semibold text-[10px] rounded transition"
                  >
                    Resolve Thread ✓
                  </button>
                )}
              </div>
            </div>

            {/* Inspector Chat logs */}
            <div className="flex-1 p-6 overflow-y-auto space-y-4 flex flex-col">
              {selectedConv.messages.map((msg) => {
                if (msg.content.startsWith("[System Notice:")) {
                  return (
                    <div key={msg.id} className="self-center bg-amber-950/30 border border-amber-900/50 rounded-lg p-3 text-xs text-amber-300 text-center max-w-md italic leading-relaxed shadow-sm">
                      {msg.content}
                    </div>
                  );
                }

                const isVisitor = msg.sender === "visitor";
                const isOwner = msg.sender === "owner";

                return (
                  <div
                    key={msg.id}
                    className={`max-w-[75%] flex flex-col gap-1 ${
                      isVisitor ? "self-end items-end" : "self-start items-start"
                    }`}
                  >
                    <div
                      className={`rounded-xl p-3 text-xs leading-relaxed shadow-sm ${
                        isVisitor
                          ? "bg-violet-600 text-white border-br-none"
                          : isOwner
                          ? "bg-indigo-950/60 text-indigo-200 border border-indigo-800/40"
                          : "bg-slate-900 text-gray-300 border border-slate-800"
                      }`}
                    >
                      {isOwner && (
                        <span className="block text-[8px] uppercase tracking-wider font-extrabold text-violet-400 mb-1">
                          Support Representative (You)
                        </span>
                      )}
                      <p>{msg.content}</p>
                    </div>
                    <span className="text-[9px] text-gray-500 font-mono">
                      {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </div>

            {/* Inspector Footer Input */}
            <form onSubmit={handleReplySubmit} className="p-4 border-t border-slate-800/80 bg-slate-950/40 flex gap-3 items-center">
              <input
                type="text"
                placeholder="Step in as a human responder and reply..."
                value={replyInput}
                onChange={(e) => setReplyInput(e.target.value)}
                disabled={isSubmitting}
                className="flex-1 bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-600 focus:ring-1 focus:ring-violet-600 transition"
              />
              <button
                type="submit"
                disabled={isSubmitting || !replyInput.trim()}
                className="px-4 py-2.5 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold rounded-lg text-xs transition duration-200 transform active:scale-95 shadow-lg shadow-indigo-600/10 glow-btn"
              >
                {isSubmitting ? "Sending..." : "Reply"}
              </button>
            </form>
          </>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-4"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
            <h4 className="text-sm font-semibold text-slate-300 mb-1">Select a Conversation</h4>
            <p className="text-xs text-slate-500 max-w-xs">Select a dialogue thread from the list to view the full dialogue transcript and reply to the visitor.</p>
          </div>
        )}
      </div>
    </div>
  );
}
