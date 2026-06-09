"use client";

import { useState } from "react";
import { createApiKeyAction, revokeApiKeyAction } from "../../actions/keys";

export interface KeyItem {
  id: string;
  name: string;
  active: boolean;
  createdAt: string;
  prefix: string;
}

interface APIKeysClientProps {
  initialKeys: KeyItem[];
}

export default function APIKeysClient({ initialKeys }: APIKeysClientProps) {
  const [keys, setKeys] = useState<KeyItem[]>(initialKeys);
  const [newKeyName, setNewKeyName] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeTab, setActiveTab] = useState<"html" | "react" | "wp">("html");

  // Key reveal popup state
  const [revealedKey, setRevealedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const activeEmbedKey = revealedKey || keys[0]?.id || "sk_live_YOUR_API_KEY_HERE";

  const handleGenerateKey = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = newKeyName.trim();
    if (!name || isGenerating) return;

    setIsGenerating(true);
    try {
      const res = await createApiKeyAction(name);
      if (res.success && res.key) {
        setRevealedKey(res.key);
        setNewKeyName("");
        // Optimistic refresh
        setKeys((prev) => [
          {
            id: res.key!, // Using raw key temporarily or standard UUID
            name,
            active: true,
            createdAt: new Date().toISOString(),
            prefix: res.key!.substring(0, 12) + "...",
          },
          ...prev,
        ]);
      } else {
        alert(res.error || "Failed to create API key.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error generating API key.");
    } finally {
      setIsGenerating(false);
    }
  };

  const handleRevokeKey = async (id: string) => {
    if (!confirm("Are you absolutely sure you want to revoke this API key? Any embedded widgets using this key will immediately stop working.")) return;

    try {
      const res = await revokeApiKeyAction(id);
      if (res.success) {
        setKeys((prev) => prev.filter((k) => k.id !== id));
      } else {
        alert(res.error || "Failed to revoke key.");
      }
    } catch (err) {
      console.error(err);
      alert("Network error revoking API Key.");
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Integration Snippets
  const htmlSnippet = `<!-- Verdia Chatbot Widget Universal Embed -->
\u003cscript>
  window.ChatbotConfig = {
    apiKey: "${activeEmbedKey}",
    apiHost: "http://localhost:8000"
  };
\u003c/script>
\u003cscript src="http://localhost:8000/widget.js" defer>\u003c/script>`;

  const reactSnippet = `// 1. Install standard integration package
npm install @verdia/ai-chatbot-widget

// 2. Render standard component in your dashboard tree
import { ChatWidget } from "@verdia/ai-chatbot-widget";

function App() {
  return (
    \u003cChatWidget
      apiKey="${activeEmbedKey}"
      position="bottom-right"
    /\u003e
  );
}`;

  const wpInstructions = `1. Compress and zip the plugin folder located at "/wordpress-plugin" inside your root project directory.
2. In your WordPress Admin Dashboard, navigate to: Plugins -> Add New -> Upload Plugin.
3. Upload and activate the "verdia-chatbot.zip" file.
4. Go to Settings -> AI Chatbot, paste your active API Key: "${activeEmbedKey}", and save!`;

  return (
    <div className="space-y-8">
      {/* Revealed Key Popup Modal Overlay */}
      {revealedKey && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex items-center justify-center z-50 p-6">
          <div className="w-full max-w-lg glass-panel p-8 rounded-2xl relative overflow-hidden border border-violet-500/30 shadow-2xl animate-scaleUp">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-violet-600 to-indigo-600" />
            <h3 className="text-xl font-bold text-white mb-2">🔑 Your Live API Key Created</h3>
            <p className="text-xs text-amber-300 leading-relaxed bg-amber-950/20 border border-amber-900/50 p-3 rounded-lg mb-6">
              ⚠️ Make sure to copy this key now! For security reasons, **we will never show this raw value to you again** once you close this window.
            </p>

            <div className="flex gap-2 mb-8 bg-slate-900 border border-slate-800 rounded-lg p-3 items-center justify-between">
              <code className="text-xs text-violet-300 font-bold truncate max-w-sm">{revealedKey}</code>
              <button
                onClick={() => copyToClipboard(revealedKey)}
                className="px-3 py-1.5 bg-violet-600 hover:bg-violet-500 rounded text-xs font-semibold text-white transition whitespace-nowrap"
              >
                {copied ? "Copied! ✓" : "Copy Key"}
              </button>
            </div>

            <button
              onClick={() => setRevealedKey(null)}
              className="w-full py-2.5 bg-slate-900 border border-slate-800 hover:bg-slate-800 text-gray-300 font-semibold text-xs rounded-lg transition"
            >
              I've copied the key safely, close window
            </button>
          </div>
        </div>
      )}

      {/* Integration Guides (Top Card) */}
      <div className="glass-panel p-6 rounded-xl space-y-6">
        <h3 className="text-md font-bold text-white border-b border-slate-800/80 pb-3">
          📥 Embed Integration Code
        </h3>

        {/* Tab Selector */}
        <div className="flex gap-1 border-b border-slate-900 pb-2">
          {(["html", "react", "wp"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-4 py-2 text-xs font-semibold border-b-2 transition-all capitalize ${
                activeTab === tab
                  ? "border-violet-600 text-white font-bold"
                  : "border-transparent text-gray-500 hover:text-gray-300"
              }`}
            >
              {tab === "html" ? "HTML / Universal Script" : tab === "react" ? "React NPM" : "WordPress Plugin"}
            </button>
          ))}
        </div>

        {/* Tab Contents */}
        <div className="space-y-4">
          {activeTab === "html" && (
            <div className="space-y-3">
              <p className="text-xs text-gray-400">
                Drop this script tag into the `&lt;head&gt;` or footer of any HTML page. The float position and brand colors will automatically sync from your customizer configurations.
              </p>
              <div className="relative bg-slate-950/80 border border-slate-900 rounded-lg p-4 font-mono text-xs text-violet-300 overflow-x-auto max-h-60">
                <pre>{htmlSnippet}</pre>
                <button
                  onClick={() => copyToClipboard(htmlSnippet)}
                  className="absolute top-3 right-3 px-2 py-1 bg-slate-900 border border-slate-800 rounded text-[10px] text-gray-400 hover:text-white transition"
                >
                  {copied ? "Copied! ✓" : "Copy"}
                </button>
              </div>
            </div>
          )}

          {activeTab === "react" && (
            <div className="space-y-3">
              <p className="text-xs text-gray-400">
                Integrate the chat widget natively inside your React JSX layout trees.
              </p>
              <div className="relative bg-slate-950/80 border border-slate-900 rounded-lg p-4 font-mono text-xs text-violet-300 overflow-x-auto max-h-60">
                <pre>{reactSnippet}</pre>
                <button
                  onClick={() => copyToClipboard(reactSnippet)}
                  className="absolute top-3 right-3 px-2 py-1 bg-slate-900 border border-slate-800 rounded text-[10px] text-gray-400 hover:text-white transition"
                >
                  {copied ? "Copied! ✓" : "Copy"}
                </button>
              </div>
            </div>
          )}

          {activeTab === "wp" && (
            <div className="space-y-3">
              <p className="text-xs text-gray-400 font-semibold">Installing WordPress Plugin manually:</p>
              <div className="bg-slate-950/60 border border-slate-900 rounded-lg p-4 font-medium text-xs text-slate-300 space-y-2 leading-relaxed">
                {wpInstructions.split("\n").map((line, idx) => (
                  <p key={idx}>{line}</p>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Key Manager List (Bottom Card) */}
      <div className="glass-panel p-6 rounded-xl space-y-6">
        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 border-b border-slate-800/80 pb-4">
          <div>
            <h3 className="text-md font-bold text-white">🔑 API Credentials</h3>
            <p className="text-xs text-gray-400 mt-0.5">Manage live keys authorized to query your data assets.</p>
          </div>

          {/* Key Generator Form */}
          <form onSubmit={handleGenerateKey} className="flex gap-2 self-start sm:self-auto">
            <input
              type="text"
              placeholder="Key Name (e.g. Production)"
              required
              value={newKeyName}
              onChange={(e) => setNewKeyName(e.target.value)}
              disabled={isGenerating}
              className="bg-slate-900 border border-slate-800 rounded-lg px-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-600 transition"
            />
            <button
              type="submit"
              disabled={isGenerating}
              className="px-4 py-1.5 bg-violet-600 hover:bg-violet-500 rounded-lg text-xs font-bold text-white transition whitespace-nowrap"
            >
              {isGenerating ? "Creating..." : "Create New Key"}
            </button>
          </form>
        </div>

        {/* Keys Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-900 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                <th className="pb-3">Credential Name</th>
                <th className="pb-3">Token Prefix</th>
                <th className="pb-3">Created Date</th>
                <th className="pb-3 text-right">Settings</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-900/50">
              {keys.map((k) => (
                <tr key={k.id} className="text-xs text-gray-300 hover:bg-slate-900/10 transition">
                  <td className="py-4 font-semibold text-slate-200">{k.name}</td>
                  <td className="py-4 font-mono text-violet-400">{k.prefix}</td>
                  <td className="py-4 text-gray-400">
                    {new Date(k.createdAt).toLocaleDateString([], { month: "short", day: "numeric", year: "numeric" })}
                  </td>
                  <td className="py-4 text-right">
                    <button
                      onClick={() => handleRevokeKey(k.id)}
                      className="px-2.5 py-1 bg-red-950/40 border border-red-900/60 hover:bg-red-900/40 text-red-400 hover:text-red-300 font-semibold rounded text-[10px] transition"
                    >
                      Revoke Key
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
