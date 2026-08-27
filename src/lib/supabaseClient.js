import { createClient } from "@supabase/supabase-js";

function normalizeSupabaseUrl(url) {
  if (!url) return url;

  const trimmed = url.trim().replace(/\/+$/, "");

  try {
    const parsed = new URL(trimmed);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return trimmed;
  }
}

const supabaseUrl = normalizeSupabaseUrl(import.meta.env.VITE_SUPABASE_URL || "https://example.supabase.co");
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || "public-anon-key";
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_ROLE?.trim() || null;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn(
    "Missing Supabase env vars. Copy .env.example to .env and fill in your project URL/anon key."
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
export const supabaseService =
  supabaseServiceKey
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: { persistSession: false, detectSessionInUrl: false },
      })
    : null;
export const supabaseServiceConfigured = !!supabaseService;
