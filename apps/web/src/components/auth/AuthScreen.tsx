import { useState, useCallback } from "react";
import { Mail, Lock, User as UserIcon, Loader2, ArrowLeft } from "@/icons/lucide-compat";
import { OpenFieldLogo } from "../brand/OpenFieldLogo";
import { useAuthStore } from "../../stores/auth-store";
import { useRouter } from "../../hooks/use-router";

type Mode = "signin" | "signup";

interface AuthScreenProps {
  initialMode?: Mode;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  initialMode = "signin",
}) => {
  const { navigate } = useRouter();
  const configured = useAuthStore((s) => s.configured);
  const signIn = useAuthStore((s) => s.signInWithPassword);
  const signUp = useAuthStore((s) => s.signUpWithPassword);
  const signInWithGoogle = useAuthStore((s) => s.signInWithGoogle);

  const [mode, setMode] = useState<Mode>(initialMode);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const isSignup = mode === "signup";

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      setNotice(null);

      if (!email || !password) {
        setError("Please enter your email and password.");
        return;
      }
      if (isSignup && password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }

      setBusy(true);
      try {
        if (isSignup) {
          const res = await signUp(email, password, displayName || undefined);
          if (!res.ok) {
            setError(res.error ?? "Could not create your account.");
          } else if (res.needsEmailConfirmation) {
            setNotice(
              "Check your inbox to confirm your email, then sign in.",
            );
            setMode("signin");
          } else {
            navigate("welcome");
          }
        } else {
          const res = await signIn(email, password);
          if (!res.ok) {
            setError(res.error ?? "Could not sign you in.");
          } else {
            navigate("welcome");
          }
        }
      } finally {
        setBusy(false);
      }
    },
    [email, password, displayName, isSignup, signIn, signUp, navigate],
  );

  const handleGoogle = useCallback(async () => {
    setError(null);
    setNotice(null);
    setBusy(true);
    const res = await signInWithGoogle();
    // On success the page redirects to Google; only reach here on failure.
    if (!res.ok) {
      setError(res.error ?? "Could not start Google sign-in.");
      setBusy(false);
    }
  }, [signInWithGoogle]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-bg px-4 text-fg">
      <div className="w-full max-w-sm">
        {/* Back to landing */}
        <button
          onClick={() => navigate("welcome")}
          className="mb-6 inline-flex items-center gap-1.5 text-[13px] text-fg-3 hover:text-fg"
        >
          <ArrowLeft size={15} /> Back
        </button>

        {/* Brand */}
        <div className="mb-8 flex justify-center">
          <OpenFieldLogo size={28} />
        </div>

        <div className="rounded-2xl border border-border bg-bg-1 p-6 shadow-sm">
          <h1 className="text-center text-lg font-bold">
            {isSignup ? "Create your account" : "Welcome back"}
          </h1>
          <p className="mt-1 text-center text-[13px] text-fg-muted">
            {isSignup
              ? "Start editing in your browser — no install."
              : "Sign in to sync your projects."}
          </p>

          {!configured && (
            <div className="mt-4 rounded-lg border border-amber-400/40 bg-amber-400/10 p-3 text-[12px] text-amber-600">
              The backend isn't configured yet. Add your Supabase keys to
              <code className="mx-1 rounded bg-black/10 px-1">.env.local</code>
              to enable accounts. You can still use the editor locally.
            </div>
          )}

          {error && (
            <div className="mt-4 rounded-lg border border-red-400/40 bg-red-400/10 p-3 text-[12px] text-red-600">
              {error}
            </div>
          )}
          {notice && (
            <div className="mt-4 rounded-lg border border-border bg-bg-2 p-3 text-[12px] text-fg-2">
              {notice}
            </div>
          )}

          {/* Primary: Google OAuth (no manual entry needed) */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={busy || !configured}
            className="mt-5 flex w-full items-center justify-center gap-2.5 rounded-lg border border-border bg-bg-2 py-2.5 text-[13px] font-semibold text-fg transition-colors hover:bg-hover disabled:opacity-50"
          >
            <GoogleGlyph />
            Continue with Google
          </button>

          <div className="my-4 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-[11px] uppercase tracking-wide text-fg-muted">
              or with email
            </span>
            <div className="h-px flex-1 bg-border" />
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            {isSignup && (
              <Field
                icon={UserIcon}
                type="text"
                placeholder="Display name (optional)"
                value={displayName}
                onChange={setDisplayName}
                autoComplete="name"
              />
            )}
            <Field
              icon={Mail}
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={setEmail}
              autoComplete="email"
              required
            />
            <Field
              icon={Lock}
              type="password"
              placeholder="Password"
              value={password}
              onChange={setPassword}
              autoComplete={isSignup ? "new-password" : "current-password"}
              required
            />

            <button
              type="submit"
              disabled={busy || !configured}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-accent-strong disabled:opacity-50"
            >
              {busy && <Loader2 size={15} className="animate-spin" />}
              {isSignup ? "Create account" : "Sign in"}
            </button>
          </form>

          <div className="mt-5 text-center text-[13px] text-fg-muted">
            {isSignup ? "Already have an account?" : "New to OpenField?"}{" "}
            <button
              onClick={() => {
                setError(null);
                setNotice(null);
                setMode(isSignup ? "signin" : "signup");
              }}
              className="font-semibold text-accent hover:underline"
            >
              {isSignup ? "Sign in" : "Create one"}
            </button>
          </div>
        </div>

        <p className="mt-6 text-center text-[11px] text-fg-muted">
          You can skip this and{" "}
          <button
            onClick={() => navigate("editor")}
            className="underline hover:text-fg"
          >
            edit locally
          </button>{" "}
          without an account.
        </p>
      </div>
    </div>
  );
};

const GoogleGlyph: React.FC = () => (
  <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
    <path
      fill="#EA4335"
      d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5Z"
    />
    <path
      fill="#4285F4"
      d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65Z"
    />
    <path
      fill="#FBBC05"
      d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19Z"
    />
    <path
      fill="#34A853"
      d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48Z"
    />
  </svg>
);

interface FieldProps {
  icon: typeof Mail;
  type: string;
  placeholder: string;
  value: string;
  onChange: (v: string) => void;
  autoComplete?: string;
  required?: boolean;
}

const Field: React.FC<FieldProps> = ({
  icon: Icon,
  type,
  placeholder,
  value,
  onChange,
  autoComplete,
  required,
}) => (
  <div className="relative">
    <Icon
      size={16}
      className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-muted"
    />
    <input
      type={type}
      placeholder={placeholder}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      autoComplete={autoComplete}
      required={required}
      className="h-10 w-full rounded-lg border border-border bg-bg-2 pl-9 pr-3 text-[13px] outline-none placeholder:text-fg-muted focus:border-accent"
    />
  </div>
);

export default AuthScreen;
