import { useState, useCallback } from "react";
import {
  Home,
  Folder,
  Palette,
  Box,
  Sparkles,
  Users,
  Search,
  Bell,
  Plus,
  FilePlus2,
  HelpCircle,
  Settings,
  ChevronRight,
  MessageSquarePlus,
  LogOut,
  LogIn,
  UserPlus,
} from "@/icons/lucide-compat";
import { OpenFieldLogo } from "../brand/OpenFieldLogo";
import { useProjectStore } from "../../stores/project-store";
import { useRouter } from "../../hooks/use-router";
import { toast } from "../../stores/notification-store";
import { FeedbackDialog } from "../feedback/FeedbackDialog";
import { useAuthStore } from "../../stores/auth-store";

const comingSoon = (feature: string) =>
  toast.info(`${feature} — coming soon`, "This is part of the OpenField AI Studio, arriving next.");

const NAV_ITEMS = [
  { id: "home", label: "Home", icon: Home },
  { id: "projects", label: "Projects", icon: Folder },
  { id: "brand", label: "Brand", icon: Palette },
  { id: "assets", label: "Assets", icon: Box },
  { id: "ai", label: "AI Tools", icon: Sparkles },
  { id: "community", label: "Community", icon: Users },
];

export const Dashboard: React.FC = () => {
  const { navigate } = useRouter();
  const createNewProject = useProjectStore((s) => s.createNewProject);
  const [activeNav, setActiveNav] = useState("home");
  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);

  const authConfigured = useAuthStore((s) => s.configured);
  const profile = useAuthStore((s) => s.profile);
  const hasSession = useAuthStore((s) => Boolean(s.session));
  const signOut = useAuthStore((s) => s.signOut);

  const avatarInitial = (
    profile?.displayName?.[0] ??
    profile?.email?.[0] ??
    "A"
  ).toUpperCase();

  const handleNewProject = useCallback(() => {
    createNewProject("Untitled Project", { width: 1920, height: 1080, frameRate: 30 });
    navigate("editor");
  }, [createNewProject, navigate]);

  return (
    <div className="flex h-full w-full bg-bg text-fg overflow-hidden">
      {/* ── Sidebar ─────────────────────────────────── */}
      <aside className="flex w-56 shrink-0 flex-col border-r border-border bg-bg-1">
        {/* Brand */}
        <div className="flex h-16 items-center px-5">
          <OpenFieldLogo size={20} />
        </div>

        {/* Nav */}
        <nav className="flex-1 space-y-0.5 px-3 py-2">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = activeNav === item.id;
            return (
              <button
                key={item.id}
                onClick={() => {
                  if (item.id === "projects") {
                    navigate("recent");
                    return;
                  }
                  if (item.id === "home") {
                    setActiveNav(item.id);
                    return;
                  }
                  comingSoon(item.label);
                }}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] font-medium transition-colors ${
                  active
                    ? "bg-selected text-accent-strong"
                    : "text-fg-3 hover:bg-hover hover:text-fg"
                }`}
              >
                <Icon size={17} />
                {item.label}
              </button>
            );
          })}
        </nav>

        {/* Plan meter */}
        <div className="mx-3 mb-3 space-y-3">
          <div className="rounded-xl border border-border bg-bg-2 p-3">
            <div className="mb-2 flex items-center gap-2">
              <div className="relative h-8 w-8">
                <svg viewBox="0 0 36 36" className="h-8 w-8 -rotate-90">
                  <circle cx="18" cy="18" r="15" fill="none" stroke="var(--border)" strokeWidth="4" />
                  <circle cx="18" cy="18" r="15" fill="none" stroke="var(--accent)" strokeWidth="4"
                    strokeDasharray={`${(3 / 10) * 94} 94`} strokeLinecap="round" />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="text-[12px] font-medium leading-tight">3 / 10 exports</p>
                <p className="text-[10px] text-fg-muted leading-tight">You're on the Free plan</p>
              </div>
            </div>
            <button
              onClick={() => comingSoon("Upgrade & billing")}
              className="w-full rounded-lg bg-accent py-1.5 text-[12px] font-semibold text-white hover:bg-accent-strong transition-colors"
            >
              Upgrade
            </button>
          </div>

          <div className="space-y-0.5">
            <button
              onClick={() => setFeedbackOpen(true)}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-fg-3 hover:bg-hover hover:text-fg transition-colors"
            >
              <MessageSquarePlus size={17} /> Send feedback
            </button>
            <button
              onClick={() => comingSoon("Help & Support")}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-fg-3 hover:bg-hover hover:text-fg transition-colors"
            >
              <HelpCircle size={17} /> Help &amp; Support
            </button>
            <button
              onClick={() => comingSoon("Settings")}
              className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-[13px] text-fg-3 hover:bg-hover hover:text-fg transition-colors"
            >
              <Settings size={17} /> Settings
            </button>
          </div>
        </div>
      </aside>

      {/* ── Main ────────────────────────────────────── */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top bar */}
        <header className="flex h-16 shrink-0 items-center gap-4 border-b border-border px-6">
          <div className="relative flex-1 max-w-xl">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted" />
            <input
              placeholder="Search OpenField…"
              className="h-9 w-full rounded-full border border-border bg-bg-2 pl-9 pr-4 text-[13px] outline-none placeholder:text-fg-muted focus:border-accent"
            />
          </div>
          <button
            onClick={handleNewProject}
            className="flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-white hover:bg-accent-strong transition-colors"
          >
            <Plus size={16} /> New Project
          </button>
          <button
            onClick={() => comingSoon("Notifications")}
            className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-hover"
            aria-label="Notifications"
          >
            <Bell size={18} className="text-fg-3" />
          </button>

          {/* ── Account (top-right) ──────────────────── */}
          <AccountMenu
            open={accountOpen}
            onToggle={() => setAccountOpen((v) => !v)}
            onClose={() => setAccountOpen(false)}
            avatarInitial={avatarInitial}
            hasSession={hasSession}
            authConfigured={authConfigured}
            displayName={profile?.displayName ?? null}
            email={profile?.email ?? null}
            onSignIn={() => {
              setAccountOpen(false);
              navigate("auth");
            }}
            onCreateAccount={() => {
              setAccountOpen(false);
              navigate("auth", { mode: "signup" });
            }}
            onSignOut={() => {
              setAccountOpen(false);
              void signOut();
            }}
          />
        </header>

        {/* Home content */}
        <main className="flex-1 overflow-y-auto p-6">
          <HomeView
            onNewProject={handleNewProject}
            onOpenProjects={() => navigate("recent")}
          />
        </main>
      </div>

      <FeedbackDialog
        isOpen={feedbackOpen}
        onClose={() => setFeedbackOpen(false)}
      />
    </div>
  );
};

// ── Account menu (top-right) ────────────────────────────────────────
interface AccountMenuProps {
  open: boolean;
  onToggle: () => void;
  onClose: () => void;
  avatarInitial: string;
  hasSession: boolean;
  authConfigured: boolean;
  displayName: string | null;
  email: string | null;
  onSignIn: () => void;
  onCreateAccount: () => void;
  onSignOut: () => void;
}

const AccountMenu: React.FC<AccountMenuProps> = ({
  open,
  onToggle,
  onClose,
  avatarInitial,
  hasSession,
  authConfigured,
  displayName,
  email,
  onSignIn,
  onCreateAccount,
  onSignOut,
}) => (
  <div className="relative">
    <button
      onClick={onToggle}
      className={`flex h-9 w-9 items-center justify-center rounded-full text-[13px] font-semibold text-white shadow-sm ring-2 transition-all ${
        open ? "ring-accent/40" : "ring-transparent hover:ring-accent/20"
      } bg-[#14201a]`}
      aria-label="Account"
      aria-haspopup="menu"
      aria-expanded={open}
    >
      {avatarInitial}
    </button>
    {open && (
      <>
        <div className="fixed inset-0 z-40" onClick={onClose} />
        <div
          role="menu"
          className="absolute right-0 top-11 z-50 w-60 overflow-hidden rounded-xl border border-border bg-bg-1 shadow-xl"
        >
          {/* Header: signed-in identity or a friendly guest state */}
          <div className="flex items-center gap-3 border-b border-border bg-bg-2/60 px-3.5 py-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[#14201a] text-[13px] font-semibold text-white">
              {avatarInitial}
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold">
                {hasSession ? (displayName ?? "Your account") : "Guest"}
              </p>
              <p className="truncate text-[11px] text-fg-muted">
                {hasSession
                  ? (email ?? "")
                  : authConfigured
                    ? "Not signed in"
                    : "Working locally"}
              </p>
            </div>
          </div>

          <div className="p-1.5">
            {hasSession ? (
              <button
                role="menuitem"
                onClick={onSignOut}
                className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] text-fg-2 hover:bg-hover"
              >
                <LogOut size={15} /> Sign out
              </button>
            ) : authConfigured ? (
              <>
                <button
                  role="menuitem"
                  onClick={onSignIn}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] text-fg-2 hover:bg-hover"
                >
                  <LogIn size={15} /> Sign in
                </button>
                <button
                  role="menuitem"
                  onClick={onCreateAccount}
                  className="mt-0.5 flex w-full items-center gap-2.5 rounded-lg bg-accent px-3 py-2 text-left text-[13px] font-semibold text-white hover:bg-accent-strong"
                >
                  <UserPlus size={15} /> Create account
                </button>
              </>
            ) : (
              <p className="px-3 py-2 text-[12px] leading-relaxed text-fg-muted">
                Configure Supabase to enable accounts and cloud sync.
              </p>
            )}
          </div>
        </div>
      </>
    )}
  </div>
);

// ── Home landing view ──────────────────────────────────────────────
interface HomeViewProps {
  onNewProject: () => void;
  onOpenProjects: () => void;
}

const HomeView: React.FC<HomeViewProps> = ({ onNewProject, onOpenProjects }) => (
  <div className="mx-auto max-w-5xl">
    {/* Cinematic hero/poster. The photo lives at /brand/dashboard-hero.jpg;
        a dark base + gradient scrim sit under it so the text is always
        readable and the banner still looks cinematic before the photo is
        added. Buttons remain fully functional. */}
    <section
      className="relative mb-8 aspect-[1024/440] w-full overflow-hidden rounded-2xl bg-[#141210] text-white"
      style={{
        backgroundImage:
          "linear-gradient(90deg, rgba(10,9,8,0.92) 0%, rgba(10,9,8,0.72) 42%, rgba(10,9,8,0.15) 100%), url('/brand/dashboard-hero.jpg')",
        backgroundSize: "cover",
        backgroundPosition: "center right",
      }}
    >
      {/* Wordmark top-left */}
      <div className="absolute left-7 top-6 z-10">
        <OpenFieldLogo size={22} color="#f4f1ea" />
      </div>

      {/* Copy + CTAs */}
      <div className="absolute left-7 top-1/2 z-10 max-w-md -translate-y-1/2">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.28em] text-white/70">
          Create without limits
        </p>
        <h1
          className="mb-3 text-[30px] font-medium leading-[1.08] sm:text-[38px]"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          Turn your ideas
          <br />
          into incredible videos.
        </h1>
        <p className="mb-6 max-w-sm text-[13px] text-white/70">
          Start from scratch and edit right in your browser — no install.
        </p>
        <div className="flex gap-3">
          <button
            onClick={onNewProject}
            className="flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-[13px] font-semibold text-[#14201a] shadow-sm transition-colors hover:bg-white/90"
          >
            <Plus size={16} /> New Project
          </button>
          <button
            onClick={onOpenProjects}
            className="flex items-center gap-2 rounded-lg border border-white/25 bg-white/10 px-5 py-2.5 text-[13px] font-semibold text-white backdrop-blur transition-colors hover:bg-white/20"
          >
            <Folder size={16} /> Your Projects
          </button>
        </div>
      </div>

      {/* Script annotation bottom-left */}
      <span
        className="absolute bottom-5 left-7 z-10 text-[18px] text-white/60"
        style={{ fontFamily: "'Caveat', cursive" }}
      >
        Ideas in motion.
      </span>

      {/* Tagline bottom-right */}
      <span className="absolute bottom-6 right-7 z-10 hidden text-right text-[10px] font-medium uppercase tracking-[0.22em] text-white/50 sm:block">
        Open a brighter
        <br />
        tomorrow.
      </span>
    </section>

    {/* Quick actions */}
    <section>
      <h2 className="mb-3 text-[15px] font-semibold">Quick start</h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <QuickCard
          icon={FilePlus2}
          title="Start from scratch"
          desc="A blank 1080p project"
          onClick={onNewProject}
        />
        <QuickCard
          icon={Folder}
          title="Your projects"
          desc="Open a recent project"
          onClick={onOpenProjects}
        />
      </div>
    </section>
  </div>
);

const QuickCard: React.FC<{
  icon: typeof FilePlus2;
  title: string;
  desc: string;
  onClick: () => void;
}> = ({ icon: Icon, title, desc, onClick }) => (
  <button
    onClick={onClick}
    className="flex items-center gap-3 rounded-xl border border-border bg-bg-1 p-4 text-left transition-colors hover:border-accent/40 hover:bg-hover"
  >
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent-soft">
      <Icon size={19} className="text-accent-strong" />
    </div>
    <div className="min-w-0 flex-1">
      <p className="text-[13px] font-semibold">{title}</p>
      <p className="truncate text-[11px] text-fg-muted">{desc}</p>
    </div>
    <ChevronRight size={15} className="shrink-0 text-fg-muted" />
  </button>
);

export default Dashboard;
