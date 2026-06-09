"use client";

import { useState } from "react";

export interface DocItem {
  id: string;
  filename: string;
  contentType: string;
  createdAt: string;
  url?: string;
}

interface KBManagerClientProps {
  initialDocs: DocItem[];
  apiHost: string;
  defaultDevKey: string;
  userEmail: string;
}

export default function KBManagerClient({
  initialDocs,
  apiHost,
  defaultDevKey,
  userEmail,
}: KBManagerClientProps) {
  const [docs, setDocs] = useState<DocItem[]>(initialDocs);
  const [urlInput, setUrlInput] = useState("");
  const [isScraping, setIsScraping] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [notice, setNotice] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showNotice = (message: string, type: "success" | "error" = "success") => {
    setNotice({ message, type });
    setTimeout(() => setNotice(null), 5000);
  };

  // 1. File Upload Handler
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsUploading(true);
    showNotice("Uploading and parsing document into vector database...", "success");

    try {
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch(`${apiHost}/api/kb/upload`, {
        method: "POST",
        headers: {
          "X-API-Key": defaultDevKey,
          "X-User-Email": userEmail,
        },
        body: formData,
      });

      if (response.ok) {
        const newDoc = await response.json();
        setDocs((prev) => [
          {
            id: newDoc.id,
            filename: newDoc.filename,
            contentType: newDoc.content_type,
            createdAt: new Date().toISOString(),
          },
          ...prev,
        ]);
        showNotice(`Document "${file.name}" successfully ingested!`);
      } else {
        const errorData = await response.json();
        showNotice(errorData.detail || "Failed to ingest document.", "error");
      }
    } catch (err) {
      console.error(err);
      showNotice("Network error. Make sure your FastAPI backend is running.", "error");
    } finally {
      setIsUploading(false);
      // Clear input value so same file can be selected again
      e.target.value = "";
    }
  };

  // 2. URL Scraping Handler
  const handleUrlSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetUrl = urlInput.trim();
    if (!targetUrl) return;

    setIsScraping(true);
    showNotice("Scraping webpage text content and embedding...", "success");

    try {
      const response = await fetch(`${apiHost}/api/kb/url`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-API-Key": defaultDevKey,
          "X-User-Email": userEmail,
        },
        body: JSON.stringify({ url: targetUrl }),
      });

      if (response.ok) {
        const newDoc = await response.json();
        setDocs((prev) => [
          {
            id: newDoc.id,
            filename: newDoc.filename,
            contentType: newDoc.content_type,
            createdAt: new Date().toISOString(),
            url: targetUrl,
          },
          ...prev,
        ]);
        setUrlInput("");
        showNotice(`Webpage successfully scraped and ingested into RAG store!`);
      } else {
        const errorData = await response.json();
        showNotice(errorData.detail || "Failed to scrape URL.", "error");
      }
    } catch (err) {
      console.error(err);
      showNotice("Network error. Make sure your FastAPI backend is running.", "error");
    } finally {
      setIsScraping(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
      {/* Upload and Crawl Forms Panel (Left/Top) */}
      <div className="lg:col-span-1 space-y-6">
        {/* Notice Alert Banner */}
        {notice && (
          <div
            className={`p-4 rounded-lg text-xs font-semibold border transition-all duration-300 animate-pulse ${
              notice.type === "success"
                ? "bg-emerald-950/40 border-emerald-800/40 text-emerald-300"
                : "bg-red-950/40 border-red-800/40 text-red-300"
            }`}
          >
            {notice.message}
          </div>
        )}

        {/* File Ingestion Card */}
        <div className="glass-panel p-6 rounded-xl relative overflow-hidden">
          <h3 className="text-md font-bold text-white mb-2">📁 Ingest Document</h3>
          <p className="text-xs text-gray-400 mb-6">Upload corporate brochures, product catalogs, or PDF guidelines.</p>

          <label className="flex flex-col items-center justify-center border-2 border-dashed border-slate-800 hover:border-violet-600/60 rounded-lg p-8 cursor-pointer transition-all bg-slate-950/20 hover:bg-slate-900/10 group">
            <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-3 group-hover:stroke-violet-400 group-hover:scale-110 transition-all"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
            <span className="text-xs font-semibold text-gray-300 text-center mb-1">
              {isUploading ? "Processing..." : "Select PDF, DOCX, or TXT"}
            </span>
            <span className="text-[10px] text-gray-500 text-center">Max size 10MB</span>
            <input
              type="file"
              accept=".pdf,.docx,.txt"
              className="hidden"
              onChange={handleFileUpload}
              disabled={isUploading || isScraping}
            />
          </label>
        </div>

        {/* URL Crawl Card */}
        <div className="glass-panel p-6 rounded-xl">
          <h3 className="text-md font-bold text-white mb-2">🌐 Scrape Website</h3>
          <p className="text-xs text-gray-400 mb-6">Paste a URL to scrape and embed its textual pages.</p>

          <form onSubmit={handleUrlSubmit} className="space-y-4">
            <input
              type="url"
              placeholder="https://example.com/about"
              required
              value={urlInput}
              onChange={(e) => setUrlInput(e.target.value)}
              disabled={isUploading || isScraping}
              className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-violet-600 focus:ring-1 focus:ring-violet-600 transition"
            />
            <button
              type="submit"
              disabled={isUploading || isScraping}
              className="w-full py-2.5 px-4 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold rounded-lg text-xs transition duration-200 transform active:scale-95 shadow-lg shadow-indigo-600/10 glow-btn"
            >
              {isScraping ? "Scraping..." : "Crawl & Embed"}
            </button>
          </form>
        </div>
      </div>

      {/* Ingested List Panel (Right/Bottom) */}
      <div className="lg:col-span-2 space-y-6">
        <div className="glass-panel p-6 rounded-xl">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h3 className="text-md font-bold text-white">🗄️ Ingested Context Items</h3>
              <p className="text-xs text-gray-400 mt-0.5">Vector chunks linked to your active knowledge base.</p>
            </div>
            <span className="px-2 py-0.5 rounded bg-violet-950/40 border border-violet-900/60 text-xs text-violet-300 font-semibold">
              {docs.length} vectors
            </span>
          </div>

          {docs.length === 0 ? (
            <div className="text-center py-16 bg-slate-950/20 border border-slate-800/30 rounded-lg flex flex-col items-center justify-center p-6">
              <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#4B5563" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mb-3"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              <h4 className="text-sm font-semibold text-slate-300 mb-1">Knowledge base is empty</h4>
              <p className="text-xs text-slate-500 max-w-xs">Upload a product guide or paste a website link to begin teaching your chatbot assistant.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-xs font-semibold text-gray-400 uppercase tracking-wider">
                    <th className="pb-3">File / Link Name</th>
                    <th className="pb-3">Format</th>
                    <th className="pb-3">Indexed At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/50">
                  {docs.map((doc) => (
                    <tr key={doc.id} className="text-xs text-gray-300 hover:bg-slate-900/10 transition">
                      <td className="py-4 font-semibold text-slate-200 truncate max-w-xs" title={doc.filename}>
                        {doc.url ? (
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-violet-400 hover:underline hover:text-violet-300 flex items-center gap-1.5"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                            {doc.filename}
                          </a>
                        ) : (
                          doc.filename
                        )}
                      </td>
                      <td className="py-4">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider ${
                            doc.contentType === "pdf"
                              ? "bg-red-950/40 border border-red-900/60 text-red-400"
                              : doc.contentType === "docx"
                              ? "bg-blue-950/40 border border-blue-900/60 text-blue-400"
                              : doc.contentType === "url"
                              ? "bg-violet-950/40 border border-violet-900/60 text-violet-400"
                              : "bg-slate-900 border border-slate-800 text-slate-400"
                          }`}
                        >
                          {doc.contentType}
                        </span>
                      </td>
                      <td className="py-4 text-gray-400">
                        {new Date(doc.createdAt).toLocaleString([], { hour: '2-digit', minute: '2-digit', month: 'short', day: 'numeric' })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
