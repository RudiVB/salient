// lib/lobby.ts — all reads/writes + realtime for the multiplayer LOBBY slice.
// Tables: sessions(code unique, status default 'lobby', host_id) and
// session_players(unique(session_id, seat)). Permissive RLS, Realtime on both.
// Anonymous identity: a stable uuid + display name kept in localStorage.

"use client";
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

/* ---------------- seats ↔ factions ---------------- */
// Four lobby seats mapped to the four living-world faction colours (lib/worldsim).
export type Seat = "player1" | "player2" | "player3" | "player4";
export const SEATS: Seat[] = ["player1", "player2", "player3", "player4"];
export interface SeatInfo { seat: Seat; faction: string; name: string; color: string; }
export const SEAT_INFO: Record<Seat, SeatInfo> = {
  player1: { seat: "player1", faction: "crimson", name: "Crimson Empire",  color: "#e5414f" },
  player2: { seat: "player2", faction: "azure",   name: "Azure Coalition", color: "#56b9cf" },
  player3: { seat: "player3", faction: "gold",    name: "Gold Federation",  color: "#f0c860" },
  player4: { seat: "player4", faction: "verdant", name: "Verdant League",  color: "#67c98a" },
};

/* ---------------- row types (match schema) ---------------- */
export interface SessionRow {
  id: string;
  code: string;
  status: string;                 // 'lobby' | 'active' | ...
  host_id: string;
  world: unknown | null;
  tick: number;
  last_turn_at: string | null;
  created_at: string;
}
export interface PlayerRow {
  id: string;
  session_id: string;
  user_id: string;
  seat: Seat;
  nation: string | null;
  display_name: string | null;
  is_ai: boolean;
  ready: boolean;
  joined_at: string;
}

/* ---------------- anonymous identity (localStorage) ---------------- */
const UID_KEY = "salient_uid";
const NAME_KEY = "salient_name";

// Stable per-browser id; created once and reused for every session.
export function getUid(): string {
  if (typeof window === "undefined") return "ssr";          // never used server-side
  let id = localStorage.getItem(UID_KEY);
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(UID_KEY, id); }
  return id;
}
export function getName(): string {
  if (typeof window === "undefined") return "Commander";
  return localStorage.getItem(NAME_KEY) || "Commander";
}
export function setName(n: string): void {
  if (typeof window !== "undefined") localStorage.setItem(NAME_KEY, n.slice(0, 20) || "Commander");
}

/* ---------------- join code ---------------- */
// 5-char code, no ambiguous chars (no 0/O/1/I) — easy to read aloud.
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function makeCode(): string {
  let c = "";
  const r = new Uint32Array(5);
  crypto.getRandomValues(r);
  for (let i = 0; i < 5; i++) c += CODE_ALPHABET[r[i] % CODE_ALPHABET.length];
  return c;
}

/* ---------------- reads ---------------- */
// All players in a session, ordered by seat for stable rendering.
export async function fetchPlayers(sessionId: string): Promise<PlayerRow[]> {
  const { data, error } = await supabase
    .from("session_players")
    .select("*")
    .eq("session_id", sessionId)
    .order("seat", { ascending: true });
  if (error) throw error;
  return (data || []) as PlayerRow[];
}
// One session by id (used after realtime UPDATE events).
export async function fetchSession(sessionId: string): Promise<SessionRow | null> {
  const { data, error } = await supabase.from("sessions").select("*").eq("id", sessionId).maybeSingle();
  if (error) throw error;
  return (data as SessionRow) || null;
}

/* ---------------- create / join ---------------- */
// Host creates a session (unique code, retrying on collision) and claims player1.
export async function createSession(): Promise<{ session: SessionRow; seat: Seat }> {
  const uid = getUid();
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = makeCode();
    const { data, error } = await supabase
      .from("sessions")
      .insert({ code, host_id: uid, status: "lobby" })   // status/tick use defaults
      .select("*")
      .single();
    if (error) {
      if (error.code === "23505") continue;               // unique_violation on code → retry
      throw error;
    }
    const session = data as SessionRow;
    // Host takes seat player1.
    const { error: pErr } = await supabase.from("session_players").insert({
      session_id: session.id, user_id: uid, seat: "player1",
      display_name: getName(), is_ai: false, ready: false,
    });
    if (pErr) throw pErr;
    return { session, seat: "player1" };
  }
  throw new Error("Could not generate a unique join code — try again.");
}

// Join an existing lobby by code; claims the first free seat.
export async function joinSession(rawCode: string): Promise<{ session: SessionRow; seat: Seat }> {
  const uid = getUid();
  const code = rawCode.trim().toUpperCase();
  const { data: sRow, error: sErr } = await supabase
    .from("sessions").select("*").eq("code", code).maybeSingle();
  if (sErr) throw sErr;
  if (!sRow) throw new Error("No lobby found with that code.");
  const session = sRow as SessionRow;
  if (session.status !== "lobby") throw new Error("That game has already started.");

  const players = await fetchPlayers(session.id);

  // Already in this lobby (e.g. rejoin) — reuse existing seat.
  const mine = players.find((p) => p.user_id === uid);
  if (mine) return { session, seat: mine.seat };

  const taken = new Set(players.map((p) => p.seat));
  // Try each free seat; UNIQUE(session_id, seat) handles races between joiners.
  for (const seat of SEATS) {
    if (taken.has(seat)) continue;
    const { error } = await supabase.from("session_players").insert({
      session_id: session.id, user_id: uid, seat,
      display_name: getName(), is_ai: false, ready: false,
    });
    if (!error) return { session, seat };
    if (error.code !== "23505") throw error;               // not a seat-collision → real error
    // 23505: someone grabbed this seat first — try the next one.
  }
  throw new Error("This lobby is full (4/4).");
}

/* ---------------- seat / nation / ready ---------------- */
// Move into a different empty seat (changes your faction).
export async function switchSeat(sessionId: string, seat: Seat): Promise<boolean> {
  const uid = getUid();
  const { error } = await supabase
    .from("session_players").update({ seat })
    .eq("session_id", sessionId).eq("user_id", uid);
  if (error) {
    if (error.code === "23505") return false;              // seat just got taken
    throw error;
  }
  return true;
}
// Choose a nation for your seat. Picking a nation clears ready (force re-confirm).
export async function chooseNation(sessionId: string, nation: string): Promise<void> {
  const uid = getUid();
  const { error } = await supabase
    .from("session_players").update({ nation, ready: false })
    .eq("session_id", sessionId).eq("user_id", uid);
  if (error) throw error;
}
// Toggle your ready flag (only allowed once a nation is chosen — enforced in UI).
export async function setReady(sessionId: string, ready: boolean): Promise<void> {
  const uid = getUid();
  const { error } = await supabase
    .from("session_players").update({ ready })
    .eq("session_id", sessionId).eq("user_id", uid);
  if (error) throw error;
}
// Update your display name on an existing seat (after editing it in the lobby).
export async function updateMyName(sessionId: string, name: string): Promise<void> {
  setName(name);
  const { error } = await supabase
    .from("session_players").update({ display_name: name })
    .eq("session_id", sessionId).eq("user_id", getUid());
  if (error) throw error;
}

/* ---------------- leave ---------------- */
// Remove yourself; if you were host, hand off to the next human, else leave as-is.
export async function leaveSession(sessionId: string): Promise<void> {
  const uid = getUid();
  const players = await fetchPlayers(sessionId);
  await supabase.from("session_players").delete().eq("session_id", sessionId).eq("user_id", uid);
  const session = await fetchSession(sessionId);
  if (session && session.host_id === uid) {
    const nextHuman = players.find((p) => p.user_id !== uid && !p.is_ai);
    if (nextHuman) {
      await supabase.from("sessions").update({ host_id: nextHuman.user_id }).eq("id", sessionId);
    }
  }
}

/* ---------------- host: fill AI + start ---------------- */
// A handful of sensible default nations for AI-filled seats (one per faction).
const AI_NATIONS: Record<Seat, string> = {
  player1: "germany", player2: "britain", player3: "france", player4: "russia",
};
// Fill every empty seat with a ready AI player, then flip the session to 'active'.
export async function startGame(sessionId: string): Promise<void> {
  const players = await fetchPlayers(sessionId);
  const taken = new Set(players.map((p) => p.seat));
  const aiRows = SEATS.filter((s) => !taken.has(s)).map((seat) => ({
    session_id: sessionId,
    user_id: `ai-${seat}`,                                 // text id, unique within session
    seat,
    nation: AI_NATIONS[seat],
    display_name: `${SEAT_INFO[seat].name} (AI)`,
    is_ai: true,
    ready: true,
  }));
  if (aiRows.length) {
    const { error } = await supabase.from("session_players").insert(aiRows);
    if (error && error.code !== "23505") throw error;      // ignore if a seat filled meanwhile
  }
  const { error: uErr } = await supabase
    .from("sessions")
    .update({ status: "active", last_turn_at: new Date().toISOString(), tick: 0 })
    .eq("id", sessionId);
  if (uErr) throw uErr;
}

// All human players have chosen a nation and readied (AI seats are always ready).
export function allReady(players: PlayerRow[]): boolean {
  if (players.length === 0) return false;
  return players.every((p) => p.is_ai || (p.ready && !!p.nation));
}

/* ---------------- realtime ---------------- */
// Subscribe to a lobby: fires onPlayers on any seat change, onSession on session change.
export function subscribeLobby(
  sessionId: string,
  onPlayers: () => void,
  onSession: (s: SessionRow) => void
): RealtimeChannel {
  const channel = supabase
    .channel(`lobby:${sessionId}`)
    .on("postgres_changes",
      { event: "*", schema: "public", table: "session_players", filter: `session_id=eq.${sessionId}` },
      () => onPlayers())                                   // reload all 4 rows (cheap)
    .on("postgres_changes",
      { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${sessionId}` },
      (payload) => onSession(payload.new as SessionRow))   // catch status → 'active'
    .subscribe();
  return channel;
}