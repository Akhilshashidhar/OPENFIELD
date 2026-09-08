import { useState, useCallback } from "react";
import { X, Bug, Lightbulb, MessageSquare, Loader2, Check } from "@/icons/lucide-compat";
import {
  submitFeedback,
  type FeedbackCategory,
} from "../../services/feedback-service";
import { useAuthStore } from "../../stores/auth-store";

interface FeedbackDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const CATEGORIES: { id: FeedbackCategory; label: string; icon: typeof Bug }[] = [
  { id: "bug", label: "Bug", icon: Bug },
  { id: "idea", label: "Idea", icon: Lightbulb },
  { id: "general", label: "General", icon: MessageSquare },
];

export const FeedbackDialog: React.FC<FeedbackDialogProps> = ({
  isOpen,
  onClose,
}) => {
  const user = useAuthStore((s) => s.user);
  const [category, setCategory] = useState<FeedbackCategory>("general");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState<number | null>(null);
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = useCallback(() => {
    setCategory("general");
    setMessage("");
    setRating(null);
    setEmail("");
    setBusy(false);
    setDone(false);
    setError(null);
  }, []);

  const close = useCallback(() => {
    onClose();
    // let the closing animation finish before clearing
    setTimeout(reset, 200);
  }, [onClose, reset]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      setError(null);
      if (!message.trim()) {
        setError("Please tell us a little more.");
        return;
      }
      setBusy(true);
      const ok = await submitFeedback({
        category,
        message,
        rating: rating ?? undefined,
        email: email || undefined,
      });
      setBusy(false);
      if (ok) {
        setDone(true);
      } else {
        setError(
          "Couldn't send feedback. The backend may not be configured yet.",
        );
      }
    },
    [category, message, rating, email],
  );

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4"
      onClick={close}
    >
      <div
        className="w-full max-w-md rounded-2xl border border-border bg-bg-1 p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[15px] font-bold">Send feedback</h2>
          <button
            onClick={close}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-fg-3 hover:bg-hover"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>

        {done ? (
          <div className="py-8 text-center">
            <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-accent-soft">
              <Check size={22} className="text-accent-strong" />
            </div>
            <p className="text-[14px] font-semibold">Thanks for the feedback!</p>
            <p className="mt-1 text-[13px] text-fg-muted">
              We read every message.
            </p>
            <button
              onClick={close}
              className="mt-5 rounded-lg bg-accent px-4 py-2 text-[13px] font-semibold text-white hover:bg-accent-strong"
            >
              Done
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Category */}
            <div className="grid grid-cols-3 gap-2">
              {CATEGORIES.map((c) => {
                const Icon = c.icon;
                const active = category === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setCategory(c.id)}
                    className={`flex flex-col items-center gap-1.5 rounded-lg border py-3 text-[12px] font-medium transition-colors ${
                      active
                        ? "border-accent bg-accent-soft text-accent-strong"
                        : "border-border text-fg-3 hover:bg-hover"
                    }`}
                  >
                    <Icon size={17} />
                    {c.label}
                  </button>
                );
              })}
            </div>

            {/* Message */}
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder={
                category === "bug"
                  ? "What went wrong? What did you expect to happen?"
                  : category === "idea"
                    ? "What would you love to see in OpenField?"
                    : "Tell us what's on your mind…"
              }
              rows={4}
              className="w-full resize-none rounded-lg border border-border bg-bg-2 p-3 text-[13px] outline-none placeholder:text-fg-muted focus:border-accent"
            />

            {/* Rating */}
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-fg-muted">How's it going?</span>
              <div className="flex gap-1">
                {[1, 2, 3, 4, 5].map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setRating(rating === n ? null : n)}
                    className={`h-7 w-7 rounded-md text-[13px] transition-colors ${
                      rating && n <= rating
                        ? "bg-accent text-white"
                        : "bg-bg-2 text-fg-3 hover:bg-hover"
                    }`}
                  >
                    {n}
                  </button>
                ))}
              </div>
            </div>

            {/* Email (only when logged out) */}
            {!user && (
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email (optional, so we can reply)"
                className="h-10 w-full rounded-lg border border-border bg-bg-2 px-3 text-[13px] outline-none placeholder:text-fg-muted focus:border-accent"
              />
            )}

            {error && (
              <p className="text-[12px] text-red-500">{error}</p>
            )}

            <button
              type="submit"
              disabled={busy}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-accent py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-accent-strong disabled:opacity-50"
            >
              {busy && <Loader2 size={15} className="animate-spin" />}
              Send feedback
            </button>
          </form>
        )}
      </div>
    </div>
  );
};

export default FeedbackDialog;
