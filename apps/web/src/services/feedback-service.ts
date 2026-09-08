import { supabase } from "../lib/supabase";

export type FeedbackCategory = "bug" | "idea" | "general";

export interface FeedbackInput {
  category: FeedbackCategory;
  message: string;
  rating?: number;
  email?: string;
  page?: string;
}

/**
 * Submit user feedback to Supabase. Returns true on success. Anonymous
 * submissions are allowed (see feedback RLS insert policy).
 */
export async function submitFeedback(input: FeedbackInput): Promise<boolean> {
  if (!supabase) return false;

  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id ?? null;
  const email = input.email?.trim() || userData.user?.email || null;

  const { error } = await supabase.from("feedback").insert({
    user_id: userId,
    email,
    category: input.category,
    rating: input.rating ?? null,
    message: input.message.trim(),
    page:
      input.page ??
      (typeof window !== "undefined" ? window.location.hash : null),
    user_agent:
      typeof navigator !== "undefined" ? navigator.userAgent : null,
  });

  return !error;
}
