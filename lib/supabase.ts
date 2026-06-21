/**
 * Supabase client. lib/supabase.ts
 *
 * Reads public env vars. If they're missing (e.g. local single-player without a
 * backend), `supabase` is null and the app keeps working offline — multiplayer
 * features just check `supabaseReady` first.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabase: SupabaseClient | null = url && anon ? createClient(url, anon, {
  auth: { persistSession: true, autoRefreshToken: true },
  realtime: { params: { eventsPerSecond: 5 } },
}) : null;

export const supabaseReady = !!supabase;

// stable per-device id for anonymous play (no login required to join a session)
export function deviceId(): string {
  if (typeof window === "undefined") return "ssr";
  let id = localStorage.getItem("salient-device-id");
  if (!id) { id = (crypto.randomUUID?.() || `dev_${Date.now()}_${Math.random().toString(36).slice(2)}`); localStorage.setItem("salient-device-id", id); }
  return id;
}