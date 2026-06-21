// lib/profiles.ts — player profile stats + leaderboard reads, and result recording.
// Ratings/W-L live on `profiles`; results are recorded once per match via the
// record_result() RPC (idempotent, server-side). Guests are never ranked.
"use client";
import { supabase } from "@/lib/supabase";
import { authUserId } from "@/lib/auth";

export interface Profile {
  id: string; username: string | null;
  wins: number; losses: number; matches: number; rating: number;
  last_played: string | null;
}
export interface LeaderRow {
  id: string; username: string | null; rating: number;
  wins: number; losses: number; matches: number; win_pct: number;
}

/* ---------------- reads ---------------- */
// The current user's profile (null if not logged in or no row yet).
export async function getMyProfile(): Promise<Profile | null> {
  const id = authUserId();
  if (!id) return null;
  const { data, error } = await supabase
    .from("profiles").select("id, username, wins, losses, matches, rating, last_played")
    .eq("id", id).maybeSingle();
  if (error) throw error;
  return (data as Profile) || null;
}

// Top 100 ranked players.
export async function getLeaderboard(): Promise<LeaderRow[]> {
  const { data, error } = await supabase.from("leaderboard").select("*");
  if (error) throw error;
  return (data || []) as LeaderRow[];
}

/* ---------------- write ---------------- */
// Record this match's outcome for the current user (idempotent server-side).
// Safe to call from multiple clients and across reloads — the RPC dedupes.
export async function recordResult(sessionId: string, faction: string, won: boolean): Promise<void> {
  if (!authUserId()) return;                         // guests aren't ranked
  const { error } = await supabase.rpc("record_result", {
    p_session: sessionId, p_faction: faction, p_won: won,
  });
  if (error) throw error;
}