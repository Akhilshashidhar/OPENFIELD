import { useCallback } from "react";
import {
  ArrowRight,
  Type,
  Music,
  Layers,
  Play,
  Scissors,
  FolderOpen,
  Clapperboard,
  Github,
} from "@/icons/lucide-compat";
import { OpenFieldLogo } from "../brand/OpenFieldLogo";
import { useRouter } from "../../hooks/use-router";
import { useAuthStore } from "../../stores/auth-store";

/**
 * Marketing landing page shown to logged-out visitors on the home route.
 * Monochrome brand: near-black on a warm off-white, serif "Openfield"
 * wordmark, black buttons, hand-drawn annotations, and a 3-step section.
 */

const GITHUB_URL = "https://github.com/Akhilshashidhar/OPENFIELD";

const INK = "#14201a"; // near-black brand ink
const PAPER = "#f8f6f1"; // warm off-white background
const MUTED = "#5b5f5a"; // muted text
const FAINT = "#8a8f89"; // faint text
const HAIRLINE = "#e6e3db"; // subtle borders

export const LandingPage: React.FC = () => {
  const { navigate } = useRouter();
  const configured = useAuthStore((s) => s.configured);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);

  const goBeta = useCallback(() => {
    if (configured) void signInWithGoogle();
    else navigate("editor");
  }, [configured, signInWithGoogle, navigate]);
  const goSignin = useCallback(() => navigate("auth"), [navigate]);
  const goEditor = useCallback(() => navigate("editor"), [navigate]);

  return (
    <div
      className="h-screen w-screen overflow-y-auto"
      style={{ background: PAPER, color: INK }}
    >
      {/* ── Nav ─────────────────────────────────────── */}
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <OpenFieldLogo size={24} />
        <nav className="hidden items-center gap-9 md:flex">
          <a href="#product" className="text-[14px] font-medium hover:opacity-70" style={{ color: MUTED }}>
            Product
          </a>
          <a
            href={GITHUB_URL}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[14px] font-medium hover:opacity-70"
            style={{ color: MUTED }}
          >
            <Github size={16} aria-hidden />
            GitHub
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <button
            onClick={goSignin}
            className="text-[14px] font-medium hover:opacity-70"
            style={{ color: INK }}
          >
            Sign in
          </button>
          <button
            onClick={goBeta}
            className="inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
            style={{ background: INK }}
          >
            Get started <ArrowRight size={14} />
          </button>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────── */}
      <section id="product" className="relative mx-auto max-w-5xl px-6 pt-10 text-center">
        <Annotation className="absolute left-2 top-6 hidden -rotate-12 lg:block">
          Your ideas
          <br />
          in motion.
        </Annotation>
        <Annotation className="absolute right-2 top-8 hidden rotate-3 lg:block">
          Create
          <br />
          without limits.
        </Annotation>

        <h1
          className="mx-auto max-w-3xl text-[40px] font-bold leading-[1.08] tracking-tight sm:text-[54px]"
          style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
        >
          The video editor
          <br />
          that <span className="italic">thinks</span> with you.
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-[16px]" style={{ color: MUTED }}>
          Edit, caption, and polish your footage — all in your browser.
        </p>

        <div className="mt-8 flex items-center justify-center gap-3">
          <button
            onClick={goBeta}
            className="inline-flex items-center gap-2 rounded-lg px-5 py-3 text-[14px] font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
            style={{ background: INK }}
          >
            Try beta <ArrowRight size={15} />
          </button>
          <button
            onClick={goEditor}
            className="rounded-lg border bg-white px-5 py-3 text-[14px] font-semibold transition-colors hover:bg-black/[0.03]"
            style={{ borderColor: HAIRLINE, color: INK }}
          >
            Try without an account
          </button>
        </div>

        {/* Editor mockup */}
        <div className="relative mx-auto mt-12 max-w-4xl">
          <Annotation className="absolute -right-2 top-1/3 hidden rotate-6 lg:block">
            Edit
            <br />
            anything.
          </Annotation>
          <Annotation className="absolute -left-4 bottom-6 hidden -rotate-6 lg:block">
            All in
            <br />
            your browser.
          </Annotation>
          <EditorMockup />
        </div>
      </section>

      {/* ── From idea to finished video ─────────────── */}
      <section className="mt-24 py-20" style={{ background: "#f1efe8" }}>
        <div className="mx-auto max-w-5xl px-6 text-center">
          <h2
            className="text-[34px] font-bold tracking-tight sm:text-[42px]"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            From idea to <span className="italic">finished video.</span>
          </h2>
          <p className="mt-3 text-[15px]" style={{ color: MUTED }}>
            A simpler way to create stunning videos.
          </p>

          <div className="mt-14 grid grid-cols-1 gap-10 sm:grid-cols-3">
            <Step n={1} icon={FolderOpen} title="Drop your footage" desc="Upload your clips, or start with an idea." />
            <Step n={2} icon={Clapperboard} title="Edit your way" desc="Use simple tools and powerful features." />
            <Step n={3} icon={Play} title="Get your video" desc="Export and share everywhere." />
          </div>

          <div className="relative mt-16">
            <Annotation className="absolute left-2 -top-4 hidden -rotate-6 lg:block">
              More stories
              <br />
              to tell.
            </Annotation>
            <Annotation className="absolute right-2 -top-4 hidden rotate-3 lg:block">
              Better videos
              <br />
              for bigger ideas.
            </Annotation>

            <div className="flex items-center justify-center gap-3">
              <button
                onClick={goBeta}
                className="inline-flex items-center gap-2 rounded-lg px-5 py-3 text-[14px] font-semibold text-white shadow-sm transition-opacity hover:opacity-90"
                style={{ background: INK }}
              >
                Try beta <ArrowRight size={15} />
              </button>
              <button
                onClick={goEditor}
                className="rounded-lg border bg-white px-5 py-3 text-[14px] font-semibold transition-colors hover:bg-black/[0.03]"
                style={{ borderColor: HAIRLINE, color: INK }}
              >
                Try without an account
              </button>
            </div>
            <p className="mt-3 text-[12px]" style={{ color: FAINT }}>
              No credit card required.
            </p>
          </div>
        </div>
      </section>

      <footer className="py-8 text-center text-[12px]" style={{ color: FAINT, borderTop: `1px solid ${HAIRLINE}` }}>
        Openfield — built on OpenReel (MIT). Create without limits.
      </footer>
    </div>
  );
};

// ── Hand-drawn style annotation ─────────────────────────────────────
const Annotation: React.FC<{ className?: string; children: React.ReactNode }> = ({
  className,
  children,
}) => (
  <span
    className={`select-none text-[16px] leading-tight ${className ?? ""}`}
    style={{ fontFamily: "'Caveat', cursive", color: "#3b3f3a" }}
  >
    {children}
  </span>
);

// ── Step card ───────────────────────────────────────────────────────
const Step: React.FC<{ n: number; icon: typeof Play; title: string; desc: string }> = ({
  n,
  icon: Icon,
  title,
  desc,
}) => (
  <div className="flex flex-col items-center text-center">
    <div className="relative mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border bg-white shadow-sm" style={{ borderColor: "#e0ddd4" }}>
      <Icon size={26} style={{ color: "#14201a" }} />
      <span className="absolute -bottom-2 -left-2 flex h-6 w-6 items-center justify-center rounded-full text-[12px] font-bold text-white" style={{ background: "#14201a" }}>
        {n}
      </span>
    </div>
    <h3 className="text-[15px] font-bold">{title}</h3>
    <p className="mt-1 max-w-[190px] text-[13px]" style={{ color: "#5b5f5a" }}>{desc}</p>
  </div>
);

// ── Editor mockup (static preview of the studio) ────────────────────
const EditorMockup: React.FC = () => (
  <div className="overflow-hidden rounded-2xl border bg-white text-left shadow-[0_20px_60px_-20px_rgba(0,0,0,0.25)]" style={{ borderColor: "#e6e3db" }}>
    {/* Top bar */}
    <div className="flex items-center gap-3 border-b px-4 py-2.5" style={{ borderColor: "#eef1ee" }}>
      <OpenFieldLogo size={15} />
      <div className="ml-2 hidden items-center gap-1.5 sm:flex">
        <span className="rounded-md bg-[#f0f0ec] px-2.5 py-1 text-[11px] font-semibold text-[#14201a]">
          Video Editor
        </span>
        <span className="rounded-md px-2.5 py-1 text-[11px] font-medium text-[#8a8f89]">
          Motion Design
        </span>
      </div>
      <span className="mx-auto text-[11px] font-medium text-[#5b5f5a]">Untitled Project ▾</span>
      <span className="hidden text-[10px] text-[#8a8f89] sm:inline">Saved</span>
      <span className="rounded-md px-3 py-1 text-[11px] font-semibold text-white" style={{ background: "#14201a" }}>
        Export
      </span>
    </div>

    {/* Body */}
    <div className="flex">
      {/* Left rail */}
      <div className="hidden w-12 flex-col items-center gap-3 border-r py-3 sm:flex" style={{ borderColor: "#eef1ee" }}>
        {[
          { icon: Layers, label: "Media", active: true },
          { icon: Type, label: "Text" },
          { icon: Music, label: "Audio" },
        ].map((it, i) => {
          const Icon = it.icon;
          return (
            <div key={i} className="flex flex-col items-center gap-0.5">
              <div
                className={`flex h-7 w-7 items-center justify-center rounded-md ${
                  it.active ? "bg-[#ecebe6] text-[#14201a]" : "text-[#8a8f89]"
                }`}
              >
                <Icon size={15} />
              </div>
              <span className="text-[8px] text-[#8a8f89]">{it.label}</span>
            </div>
          );
        })}
      </div>

      {/* Media list */}
      <div className="hidden w-40 border-r p-3 md:block" style={{ borderColor: "#eef1ee" }}>
        <p className="mb-2 text-[12px] font-semibold text-[#14201a]">Media</p>
        <div className="grid grid-cols-2 gap-2">
          {["#5b7cb8", "#c98a5b", "#6b8f6b", "#8a6bb0"].map((c, i) => (
            <div
              key={i}
              className="aspect-video rounded-md"
              style={{ background: `linear-gradient(135deg, ${c}, #1f2937)` }}
            />
          ))}
        </div>
      </div>

      {/* Preview */}
      <div className="flex-1 p-4">
        <div className="relative flex aspect-video items-center justify-center overflow-hidden rounded-lg bg-gradient-to-br from-[#4a3520] via-[#7a5a30] to-[#c99a55]">
          <span
            className="text-[22px] font-semibold text-white/95"
            style={{ fontFamily: "'Playfair Display', serif" }}
          >
            A Bigger
            <br />
            Tomorrow
          </span>
        </div>
        <div className="mt-2 flex items-center gap-2 text-[10px] text-[#8a8f89]">
          <Play size={12} className="text-[#14201a]" />
          <span>00:00 / 00:20</span>
          <span className="ml-auto">16:9 · 100%</span>
        </div>
      </div>

      {/* Properties */}
      <div className="hidden w-44 border-l p-3 lg:block" style={{ borderColor: "#eef1ee" }}>
        <div className="mb-3 flex gap-3 text-[11px]">
          <span className="border-b-2 pb-1 font-semibold text-[#14201a]" style={{ borderColor: "#14201a" }}>
            Properties
          </span>
          <span className="text-[#8a8f89]">Effects</span>
        </div>
        {["Transform", "Crop", "Color", "Audio", "Speed"].map((row) => (
          <div
            key={row}
            className="flex items-center justify-between border-b py-1.5 text-[11px] text-[#5b5f5a]"
            style={{ borderColor: "#f2f2ee" }}
          >
            {row}
            <span className="text-[#c3c6c1]">▾</span>
          </div>
        ))}
      </div>
    </div>

    {/* Timeline */}
    <div className="border-t p-3" style={{ borderColor: "#eef1ee" }}>
      <div className="mb-2 flex items-center gap-2 text-[#8a8f89]">
        <Scissors size={12} />
        <span className="text-[10px]">00:00 · 00:05 · 00:10 · 00:15 · 00:20</span>
      </div>
      <div className="space-y-1.5">
        <div className="h-6 rounded bg-gradient-to-r from-[#3a4a42]/70 to-[#5b5f5a]/70" />
        <div className="h-6 rounded bg-[#2b3a30]/60" />
        <div className="h-5 w-1/3 rounded bg-[#8a8f89]/50" />
      </div>
    </div>
  </div>
);

export default LandingPage;
