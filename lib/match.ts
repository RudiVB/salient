// lib/match.ts — reads/writes + realtime for an ACTIVE multiplayer match.
// World authority: only the host writes sessions.world. Players influence the
// game by setting their own stance on session_players; the host reads it each turn.
"use client";
import { supabase } from "@/lib/supabase";
import { getUid } from "@/lib/lobby";
import { SEAT_FACTION, type MPWorld, type Stance, type FactionId } from "@/lib/mpworld";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface MatchSession {
  id: string; code: string; status: string; host_id: string;
  world: MPWorld | null; tick: number; last_turn_at: string | null;
}

/* ---------------- reads ---------------- */
export async function loadMatch(sessionId: string): Promise<MatchSession | null> {
  const { data, error } = await supabase
    .from("sessions").select("id, code, status, host_id, world, tick, last_turn_at")
    .eq("id", sessionId).maybeSingle();
  if (error) throw error;
  return (data as MatchSession) || null;
}

// All seats with their current stance — host uses this each turn; UI uses it to
// label factions. Returns factionId -> stance and factionId -> seat metadata.
export interface SeatStance { seat: string; factionId: FactionId; stance: Stance; }
export async function fetchSeatStances(sessionId: string): Promise<Record<string, Stance>> {
  const { data, error } = await supabase
    .from("session_players").select("seat, stance").eq("session_id", sessionId);
  if (error) throw error;
  const out: Record<string, Stance> = {};
  for (const r of (data || []) as { seat: string; stance: Stance }[]) {
    const f = SEAT_FACTION[r.seat]; if (f) out[f] = (r.stance as Stance) || "balanced";
  }
  return out;
}

/* ---------------- writes ---------------- */
// Host-only: persist the advanced world.
export async function writeWorld(sessionId: string, world: MPWorld): Promise<void> {
  const { error } = await supabase
    .from("sessions")
    .update({ world, tick: world.tick, last_turn_at: new Date().toISOString() })
    .eq("id", sessionId);
  if (error) throw error;
}

// Any player: set my stance (host picks it up next turn). RLS permits self-update.
export async function setStance(sessionId: string, stance: Stance): Promise<void> {
  const { error } = await supabase
    .from("session_players").update({ stance })
    .eq("session_id", sessionId).eq("user_id", getUid());
  if (error) throw error;
}

// Host-only: end the match (everyone returns to the menu).
export async function endMatch(sessionId: string): Promise<void> {
  const { error } = await supabase.from("sessions").update({ status: "ended" }).eq("id", sessionId);
  if (error) throw error;
}

/* ---------------- realtime ---------------- */
// Fires whenever the session row changes (new world from host, status change).
export function subscribeMatch(sessionId: string, onSession: (s: MatchSession) => void): RealtimeChannel {
  return supabase.channel(`match:${sessionId}`)
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${sessionId}` },
      (p) => onSession(p.new as MatchSession))
    .subscribe();
}