import { redirect } from "next/navigation";
import Link from "next/link";
import { getAuthenticatedUser } from "../../lib/auth-server";
import { logoutAction } from "../actions/auth";

// Lucide icons exported as inline SVGs to avoid any React import mismatches
const DashboardIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>
);

const KBIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><path d="M6 6h10M6 10h10"/></svg>
);

const CustomizerIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21 16-4 4-4-4M21 8l-4-4-4 4M3 7h10M3 17h10M17 4v16"/></svg>
);

const ConversationsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
);

const KeyIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21 2-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"/></svg>
);

const OnboardingIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z"/><path d="m9 12 2 2 4-4"/></svg>
);

const LogoutIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9"/></svg>
);

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Ensure the user is authenticated, redirect to /login otherwise
  const user = await getAuthenticatedUser();
  if (!user) {
    redirect("/login");
  }

  const navLinks = [
    { href: "/dashboard", label: "Overview", icon: DashboardIcon },
    { href: "/dashboard/onboarding", label: "Onboarding Wizard", icon: OnboardingIcon },
    { href: "/dashboard/kb", label: "Knowledge Base", icon: KBIcon },
    { href: "/dashboard/customizer", label: "Widget Customizer", icon: CustomizerIcon },
    { href: "/dashboard/conversations", label: "Conversations Log", icon: ConversationsIcon },
    { href: "/dashboard/api-keys", label: "API Keys & Integrations", icon: KeyIcon },
  ];

  return (
    <div className="flex min-h-screen bg-[#020205] text-[#e2e8f0]">
      {/* Sidebar Navigation */}
      <aside className="w-64 glass-panel border-y-0 border-l-0 border-r border-slate-800/80 flex flex-col justify-between fixed h-screen z-20">
        <div>
          {/* Logo / Title */}
          <div className="p-6 border-b border-slate-800/80">
            <Link href="/dashboard" className="flex items-center gap-3">
              <span className="text-xl font-extrabold text-gradient tracking-tight">Verdia AI</span>
              <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded bg-violet-950/60 border border-violet-800/40 text-violet-300">SaaS</span>
            </Link>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1">
            {navLinks.map((link) => {
              const Icon = link.icon;
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className="flex items-center gap-3 px-4 py-3 rounded-lg text-sm text-gray-400 hover:text-white hover:bg-slate-900/60 hover:border-slate-800 border border-transparent transition-all"
                >
                  <Icon />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Footer Profile & Logout */}
        <div className="p-4 border-t border-slate-800/80 space-y-3">
          {/* Company details */}
          <div className="px-4 py-2 rounded-lg bg-slate-950/40 border border-slate-800/50 flex flex-col">
            <span className="text-xs font-semibold text-violet-300 truncate">{user.companyName || "My Business"}</span>
            <span className="text-[10px] text-gray-500 truncate">{user.email}</span>
          </div>

          <form action={logoutAction}>
            <button
              type="submit"
              className="w-full flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm text-red-400 hover:text-red-300 hover:bg-red-950/20 hover:border-red-900/40 border border-transparent transition-all"
            >
              <LogoutIcon />
              <span>Sign Out</span>
            </button>
          </form>
        </div>
      </aside>

      {/* Main Panel Content */}
      <main className="flex-1 ml-64 min-h-screen p-8 relative overflow-x-hidden">
        {/* Ambient Neon Blobs */}
        <div className="absolute top-0 right-1/4 w-[500px] height-[500px] rounded-full bg-violet-900/5 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-0 left-1/4 w-[400px] height-[400px] rounded-full bg-indigo-900/5 blur-[100px] pointer-events-none" />

        <div className="relative z-10 w-full max-w-6xl mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
}
