"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { registerAction } from "../actions/auth";

export default function RegisterPage() {
  const [state, formAction] = useFormState<any, any>(registerAction as any, null as any);

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6 relative overflow-hidden bg-[#020205]">
      {/* Glow Effects */}
      <div className="absolute top-1/4 left-1/4 w-[400px] height-[400px] rounded-full bg-violet-900/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-[450px] height-[450px] rounded-full bg-indigo-900/10 blur-[120px] pointer-events-none" />

      {/* Main Container */}
      <div className="w-full max-w-md glass-panel p-8 rounded-2xl relative z-10">
        <div className="text-center mb-6">
          <h1 className="text-3xl font-extrabold text-gradient mb-2 tracking-tight">Create Account</h1>
          <p className="text-gray-400 text-sm">Register your business and seed your AI Chatbot</p>
        </div>

        <form action={formAction} className="space-y-4">
          {/* Error Message */}
          {state?.error && (
            <div className="p-3 bg-red-950/40 border border-red-800/50 rounded-lg text-red-300 text-sm text-center">
              {state.error}
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Email Address</label>
            <input
              type="email"
              name="email"
              placeholder="owner@mycompany.com"
              required
              className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-600 focus:ring-1 focus:ring-violet-600 transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Company Name</label>
            <input
              type="text"
              name="companyName"
              placeholder="My Company Inc."
              required
              className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-600 focus:ring-1 focus:ring-violet-600 transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Password</label>
            <input
              type="password"
              name="password"
              placeholder="••••••••"
              required
              className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-600 focus:ring-1 focus:ring-violet-600 transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-300 uppercase tracking-wider">Confirm Password</label>
            <input
              type="password"
              name="confirmPassword"
              placeholder="••••••••"
              required
              className="w-full bg-slate-900/60 border border-slate-800 rounded-lg px-4 py-2 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-violet-600 focus:ring-1 focus:ring-violet-600 transition"
            />
          </div>

          <button
            type="submit"
            className="w-full py-3 px-4 mt-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold rounded-lg text-sm transition duration-200 transform active:scale-95 shadow-lg shadow-indigo-600/20 glow-btn"
          >
            Create Account & Onboard
          </button>
        </form>

        <div className="mt-6 text-center border-t border-slate-800/80 pt-4">
          <p className="text-sm text-gray-400">
            Already have an account?{" "}
            <Link href="/login" className="text-violet-400 hover:text-violet-300 font-medium underline underline-offset-4">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </main>
  );
}
