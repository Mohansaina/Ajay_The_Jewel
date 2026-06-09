"use client";

import { useState, useEffect } from "react";
import { updateSettingsAction } from "../../actions/settings";

interface SettingsState {
  brandColor: string;
  welcomeMessage: string;
  position: string;
  escalationEmail: string;
  escalationSubjectPrefix: string;
  emailCaptureRequired: boolean;
  confidenceThreshold: number;
}

interface CustomizerClientProps {
  initialSettings: SettingsState;
}

export default function CustomizerClient({ initialSettings }: CustomizerClientProps) {
  const [settings, setSettings] = useState<SettingsState>(initialSettings);
  const [isSaving, setIsSaving] = useState(false);
  const [notice, setNotice] = useState<{ message: string; type: "success" | "error" } | null>(null);

  // Simulator state
  const [simOpen, setSimOpen] = useState(false);
  const [simMessages, setSimMessages] = useState<Array<{ sender: string; content: string }>>([]);
  const [simInput, setSimInput] = useState("");
  const [simTyping, setSimTyping] = useState(false);

  // Initialize simulator welcome message when settings change
  useEffect(() => {
    setSimMessages([
      {
        sender: "assistant",
        content: settings.welcomeMessage,
      },
    ]);
  }, [settings.welcomeMessage]);

  const presetColors = [
    { name: "Royal Blue", value: "#2563EB" },
    { name: "Cyber Purple", value: "#8B5CF6" },
    { name: "Emerald Green", value: "#10B981" },
    { name: "Crimson Red", value: "#EF4444" },
    { name: "Neon Orange", value: "#F59E0B" },
    { name: "Deep Charcoal", value: "#374151" },
  ];

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setNotice(null);

    try {
      const response = await updateSettingsAction(settings);
      if (response.success) {
        setNotice({ message: "Widget settings successfully saved and synced live! 🎉", type: "success" });
      } else {
        setNotice({ message: response.error || "Failed to save settings.", type: "error" });
      }
    } catch (err) {
      console.error(err);
      setNotice({ message: "Network error saving settings.", type: "error" });
    } finally {
      setIsSaving(false);
      setTimeout(() => setNotice(null), 5000);
    }
  };

  const [simConvId] = useState(() => crypto.randomUUID());

  const sendSimMessage = async () => {
    const text = simInput.trim();
    if (!text || simTyping) return;

    setSimInput("");
    setSimMessages((prev) => [...prev, { sender: "visitor", content: text }]);
    setSimTyping(true);

    try {
      const apiHost = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      const response = await fetch(`${apiHost}/api/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": "sk_live_test_key_1234567890", // Dev pre-seeded Key
        },
        body: JSON.stringify({
          query: text,
          conversation_id: simConvId,
          visitor_email: "simulator@verdia.ai",
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned HTTP ${response.status}`);
      }

      setSimTyping(false);

      const reader = response.body?.getReader();
      if (!reader) throw new Error("ReadableStream not supported by response body.");

      const decoder = new TextDecoder();
      let buffer = "";
      let streamedResponse = "";

      // Add a blank placeholder assistant message to stream tokens into
      setSimMessages((prev) => [...prev, { sender: "assistant", content: "" }]);

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith("data: ")) continue;

          const dataStr = trimmed.substring(6);
          if (dataStr === "[DONE]") break;

          try {
            const dataObj = JSON.parse(dataStr);
            if (dataObj.text) {
              streamedResponse += dataObj.text;
              // Update the last message in state
              setSimMessages((prev) => {
                const updated = [...prev];
                if (updated.length > 0) {
                  updated[updated.length - 1] = {
                    sender: "assistant",
                    content: streamedResponse,
                  };
                }
                return updated;
              });
            }
          } catch (err) {
            // Ignore parse errors
          }
        }
      }
    } catch (err: any) {
      console.error(err);
      setSimTyping(false);
      const apiHost = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
      setSimMessages((prev) => [
        ...prev,
        {
          sender: "assistant",
          content: `[System Error: ${err.message || "Failed to connect"}. Make sure your FastAPI backend is running at ${apiHost} and database is active!]`,
        },
      ]);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
      {/* Editor Panel (Left) */}
      <form onSubmit={handleSave} className="lg:col-span-7 space-y-6">
        {/* Sync Alert */}
        {notice && (
          <div
            className={`p-4 rounded-lg text-xs font-semibold border transition-all duration-300 ${
              notice.type === "success"
                ? "bg-emerald-950/40 border-emerald-800/40 text-emerald-300"
                : "bg-red-950/40 border-red-800/40 text-red-300"
            }`}
          >
            {notice.message}
          </div>
        )}

        {/* Brand Appearance Card */}
        <div className="glass-panel p-6 rounded-xl space-y-6">
          <h3 className="text-md font-bold text-white border-b border-slate-800/80 pb-3 flex items-center gap-2">
            🎨 Widget Appearance
          </h3>

          {/* Color Picker */}
          <div className="space-y-3">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Brand Highlight Color</label>
            <div className="flex flex-wrap gap-2.5">
              {presetColors.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setSettings((prev) => ({ ...prev, brandColor: color.value }))}
                  className={`w-8 h-8 rounded-full border-2 transition-all relative ${
                    settings.brandColor === color.value ? "border-white scale-110" : "border-transparent"
                  }`}
                  style={{ backgroundColor: color.value }}
                  title={color.name}
                />
              ))}
              <div className="relative flex items-center">
                <input
                  type="color"
                  value={settings.brandColor}
                  onChange={(e) => setSettings((prev) => ({ ...prev, brandColor: e.target.value }))}
                  className="w-8 h-8 rounded-full border-2 border-slate-700 bg-transparent cursor-pointer overflow-hidden p-0"
                />
              </div>
            </div>
          </div>

          {/* Positioning */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Float Position</label>
              <select
                value={settings.position}
                onChange={(e) => setSettings((prev) => ({ ...prev, position: e.target.value }))}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 text-xs text-white focus:outline-none focus:border-violet-600 transition"
              >
                <option value="bottom-right">Bottom Right</option>
                <option value="bottom-left">Bottom Left</option>
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Email Capture Policy</label>
              <select
                value={settings.emailCaptureRequired ? "true" : "false"}
                onChange={(e) => setSettings((prev) => ({ ...prev, emailCaptureRequired: e.target.value === "true" }))}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 text-xs text-white focus:outline-none focus:border-violet-600 transition"
              >
                <option value="false">Optional Chat</option>
                <option value="true">Require Email First</option>
              </select>
            </div>
          </div>

          {/* Welcome Message */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">AI Welcome Message</label>
            <textarea
              rows={3}
              value={settings.welcomeMessage}
              onChange={(e) => setSettings((prev) => ({ ...prev, welcomeMessage: e.target.value }))}
              placeholder="Hi there! How can I help you today?"
              className="w-full bg-slate-900 border border-slate-800 rounded-lg p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-600 transition resize-none"
            />
          </div>
        </div>

        {/* Escalation Configurations Card */}
        <div className="glass-panel p-6 rounded-xl space-y-6">
          <h3 className="text-md font-bold text-white border-b border-slate-800/80 pb-3">
            ✉️ Email Escalation Rules
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Escalation Recipient</label>
              <input
                type="email"
                required
                value={settings.escalationEmail}
                onChange={(e) => setSettings((prev) => ({ ...prev, escalationEmail: e.target.value }))}
                placeholder="owner@mycompany.com"
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 text-xs text-white focus:outline-none focus:border-violet-600 transition"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Subject Prefix</label>
              <input
                type="text"
                required
                value={settings.escalationSubjectPrefix}
                onChange={(e) => setSettings((prev) => ({ ...prev, escalationSubjectPrefix: e.target.value }))}
                placeholder="[AI Chatbot Escalation]"
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-4 py-2.5 text-xs text-white focus:outline-none focus:border-violet-600 transition"
              />
            </div>
          </div>

          {/* RAG Confidence threshold */}
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <label className="text-xs font-semibold text-gray-400 uppercase tracking-wider">AI Confidence Threshold</label>
              <span className="text-xs font-bold text-violet-400">{Math.round(settings.confidenceThreshold * 100)}%</span>
            </div>
            <input
              type="range"
              min="0.1"
              max="1.0"
              step="0.05"
              value={settings.confidenceThreshold}
              onChange={(e) => setSettings((prev) => ({ ...prev, confidenceThreshold: parseFloat(e.target.value) }))}
              className="w-full h-1.5 bg-slate-900 border border-slate-800 rounded-lg appearance-none cursor-pointer accent-violet-600"
            />
            <p className="text-[10px] text-gray-500 leading-relaxed">
              If the AI's best matching vector similarity score falls below this threshold, it will immediately stream aHuman Escalation notification and trigger email escalation alerts to your address.
            </p>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSaving}
          className="w-full py-3 px-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-bold rounded-lg text-sm transition duration-200 transform active:scale-95 shadow-lg shadow-indigo-600/10 glow-btn"
        >
          {isSaving ? "Saving Config..." : "Save Settings & Sync Live"}
        </button>
      </form>

      {/* Simulator Panel (Right) */}
      <div className="lg:col-span-5 flex flex-col items-center">
        {/* Simulated Browser Card */}
        <div className="w-full max-w-sm rounded-2xl border border-slate-800/80 bg-slate-950 p-4 shadow-2xl relative overflow-hidden h-[630px] flex flex-col justify-between">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-600 to-indigo-600" />
          
          {/* Header */}
          <div className="flex items-center justify-between border-b border-slate-900 pb-3 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
              <div className="w-2.5 h-2.5 rounded-full bg-green-500" />
            </div>
            <span className="text-[10px] font-mono text-gray-500">Live Preview Simulator</span>
          </div>

          {/* Simulated Workspace View */}
          <div className="flex-1 bg-[#090815] rounded-xl border border-slate-900/60 p-4 relative overflow-hidden flex flex-col justify-end">
            {/* Overlay Grid */}
            <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.01)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.01)_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />

            {simOpen ? (
              /* Simulated Active Chat Window */
              <div className="w-full h-full bg-slate-950/90 border border-slate-900/80 rounded-xl flex flex-col justify-between overflow-hidden shadow-xl animate-fadeIn">
                {/* Simulated Header */}
                <div
                  className="p-3 text-white flex items-center justify-between text-xs font-semibold"
                  style={{ backgroundColor: settings.brandColor }}
                >
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-white/20 border border-white/40 flex items-center justify-center font-bold text-[10px]">
                      AI
                    </div>
                    <div>
                      <h4 className="font-bold">Support Agent</h4>
                      <p className="text-[9px] opacity-90">Online</p>
                    </div>
                  </div>
                  <button onClick={() => setSimOpen(false)} className="opacity-80 hover:opacity-100 font-bold">
                    ✕
                  </button>
                </div>

                {/* Simulated Logs */}
                <div className="flex-1 p-3 overflow-y-auto space-y-3 flex flex-col">
                  {simMessages.map((msg, idx) => (
                    <div
                      key={idx}
                      className={`max-w-[85%] rounded-xl p-2.5 text-xs ${
                        msg.sender === "visitor"
                          ? "self-end text-white"
                          : "self-start bg-slate-900 text-gray-300 border border-slate-800"
                      }`}
                      style={{
                        backgroundColor: msg.sender === "visitor" ? settings.brandColor : undefined,
                      }}
                    >
                      {msg.content.split("\n").map((line, lIdx) => (
                        <p key={lIdx} className="mb-1 last:mb-0">{line}</p>
                      ))}
                    </div>
                  ))}

                  {simTyping && (
                    <div className="self-start bg-slate-900 border border-slate-800 rounded-xl p-2 text-xs flex gap-1 items-center w-12">
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" />
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: "0.15s" }} />
                      <div className="w-1.5 h-1.5 rounded-full bg-gray-500 animate-bounce" style={{ animationDelay: "0.3s" }} />
                    </div>
                  )}
                </div>

                {/* Simulated Input */}
                <div className="p-2 border-t border-slate-900 bg-slate-950 flex gap-2 items-center">
                  <input
                    type="text"
                    placeholder="Type in sandbox..."
                    value={simInput}
                    onChange={(e) => setSimInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && sendSimMessage()}
                    className="flex-1 bg-slate-900 border border-slate-800 rounded-full px-3 py-1.5 text-xs text-white placeholder-slate-600 focus:outline-none focus:border-violet-600 transition"
                  />
                  <button
                    onClick={sendSimMessage}
                    className="p-1.5 rounded-full text-white hover:bg-slate-900"
                    style={{ color: settings.brandColor }}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  </button>
                </div>
              </div>
            ) : (
              /* Simulated Floating Launcher Widget */
              <div
                className={`flex flex-col items-center justify-end h-full w-full ${
                  settings.position === "bottom-left" ? "items-start" : "items-end"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setSimOpen(true)}
                  className="w-12 h-12 rounded-full shadow-2xl flex items-center justify-center text-white cursor-pointer hover:scale-105 active:scale-95 transition"
                  style={{ backgroundColor: settings.brandColor }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
