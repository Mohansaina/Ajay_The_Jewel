import Link from "next/link";
import { getAuthenticatedUser } from "../../../lib/auth-server";
import { prisma } from "../../../lib/db";
import OnboardingWizardClient from "./OnboardingWizardClient";

export default async function OnboardingPage() {
  const user = await getAuthenticatedUser();
  if (!user) return null;

  // 1. Check if the user has uploaded at least one document to start the onboarding flow
  const firstDoc = await prisma.knowledgeBaseDoc.findFirst({
    where: {
      userId: user.id,
    },
  });

  const apiHost = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="border-b border-slate-800/80 pb-6">
        <h1 className="text-3xl font-extrabold tracking-tight text-white mb-1">AI Onboarding Wizard</h1>
        <p className="text-gray-400 text-sm">
          Let the AI generate contextually relevant customer questions, and refine answers for the bot.
        </p>
      </div>

      {!firstDoc ? (
        /* Empty State redirecting to KB */
        <div className="glass-panel p-8 rounded-xl text-center max-w-2xl mx-auto py-16 flex flex-col items-center">
          <div className="p-4 bg-violet-950/40 rounded-full border border-violet-800/40 text-violet-400 mb-6 animate-bounce">
            <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          </div>
          <h3 className="text-xl font-bold text-white mb-2">Step 1: Feed Your Knowledge Base First</h3>
          <p className="text-sm text-gray-400 max-w-md mb-8 leading-relaxed">
            The AI onboarding assistant needs at least one uploaded document (e.g., brochure, product catalog) to generate contextually relevant customer questions.
          </p>
          <Link
            href="/dashboard/kb"
            className="px-5 py-3 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 text-white font-semibold text-sm transition shadow-lg shadow-indigo-600/10 glow-btn"
          >
            Upload Document Now
          </Link>
        </div>
      ) : (
        /* Wizard Client Mounting */
        <OnboardingWizardClient
          apiHost={apiHost}
          defaultDevKey="sk_live_test_key_1234567890"
          userEmail={user.email}
        />
      )}
    </div>
  );
}
