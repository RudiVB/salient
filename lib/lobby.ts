// lib/lobby.ts — reads/writes + realtime for the multiplayer lobby.
// Identity comes from lib/auth (auth user id when logged in, else guest id), so
// the same code path works for accounts and guests. Tables: sessions /
// session_players (+ visibility/name/max_players) and the public_lobbies view.
"use client";
import { supabase } from "@/lib/supabase";
import { currentUid, displayName, setLocalName, upsertProfile, authUserId } from "@/lib/auth";
import { SEAT_FACTION, seedMPWorld, type MPPlayerMeta, type Stance } from "@/lib/mpworld";
import type { RealtimeChannel } from "@supabase/supabase-js";

/* ---------------- identity (delegated to auth) ---------------- */
export const getUid = (): string => currentUid();
export const getName = (): string => displayName();
export async function setName(n: string): Promise<void> {
  setLocalName(n);
  const uid = authUserId();
  if (uid) await upsertProfile(uid, n);   // keep profile username in sync when logged in
}

/* ---------------- seats ↔ factions ---------------- */
export type Seat = "player1" | "player2" | "player3" | "player4";
export const SEATS: Seat[] = ["player1", "player2", "player3", "player4"];
export interface SeatInfo { seat: Seat; faction: string; name: string; color: string; }
export const SEAT_INFO: Record<Seat, SeatInfo> = {
  player1: { seat: "player1", faction: "crimson", name: "Crimson Empire",  color: "#e5414f" },
  player2: { seat: "player2", faction: "azure",   name: "Azure Coalition", color: "#56b9cf" },
  player3: { seat: "player3", faction: "gold",    name: "Gold Federation",  color: "#f0c860" },
  player4: { seat: "player4", faction: "verdant", name: "Verdant League",  color: "#67c98a" },
};

/* ---------------- row types ---------------- */
export type Visibility = "public" | "private";
export interface SessionRow {
  id: string; code: string; status: string; host_id: string;
  world: unknown | null; tick: number; last_turn_at: string | null; created_at: string;
  visibility: Visibility; name: string | null; max_players: number;
}
export interface PlayerRow {
  id: string; session_id: string; user_id: string; seat: Seat;
  nation: string | null; display_name: string | null; is_ai: boolean; ready: boolean;
  stance: string; joined_at: string;
}
export interface PublicLobby {
  id: string; code: string; name: string | null; host_id: string;
  created_at: string; max_players: number; player_count: number;
}

/* ---------------- join code ---------------- */
const CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";   // no 0/O/1/I
function makeCode(): string {
  let c = ""; const r = new Uint32Array(5); crypto.getRandomValues(r);
  for (let i = 0; i < 5; i++) c += CODE_ALPHABET[r[i] % CODE_ALPHABET.length];
  return c;
}

/* ---------------- reads ---------------- */
export async function fetchPlayers(sessionId: string): Promise<PlayerRow[]> {
  const { data, error } = await supabase
    .from("session_players").select("*").eq("session_id", sessionId).order("seat", { ascending: true });
  if (error) throw error;
  return (data || []) as PlayerRow[];
}
export async function fetchSession(sessionId: string): Promise<SessionRow | null> {
  const { data, error } = await supabase.from("sessions").select("*").eq("id", sessionId).maybeSingle();
  if (error) throw error;
  return (data as SessionRow) || null;
}
// Server browser: open, public lobbies with live player counts.
export async function listPublicLobbies(): Promise<PublicLobby[]> {
  const { data, error } = await supabase
    .from("public_lobbies").select("*").order("created_at", { ascending: false }).limit(40);
  if (error) throw error;
  return (data || []) as PublicLobby[];
}

/* ---------------- seat claim helper ---------------- */
// Claim the first free seat in a session for the current user. Race-safe via the
// UNIQUE(session_id, seat) constraint (retries the next seat on 23505).
async function claimFreeSeat(session: SessionRow): Promise<Seat> {
  const uid = getUid();
  const players = await fetchPlayers(session.id);
  const mine = players.find((p) => p.user_id === uid);
  if (mine) return mine.seat;                                   // rejoin → keep seat
  const taken = new Set(players.map((p) => p.seat));
  for (const seat of SEATS) {
    if (taken.has(seat)) continue;
    const { error } = await supabase.from("session_players").insert({
      session_id: session.id, user_id: uid, seat,
      display_name: getName(), is_ai: false, ready: false,
    });
    if (!error) return seat;
    if (error.code !== "23505") throw error;                   // not a seat collision
  }
  throw new Error("This lobby is full.");
}

/* ---------------- create / join ---------------- */
export interface CreateOpts { name?: string; visibility?: Visibility; }
// Host creates a session (unique code) and claims player1.
export async function createSession(opts: CreateOpts = {}): Promise<{ session: SessionRow; seat: Seat }> {
  const uid = getUid();
  const name = (opts.name?.trim() || `${getName()}'s War`).slice(0, 40);
  const visibility: Visibility = opts.visibility === "private" ? "private" : "public";
  for (let attempt = 0; attempt < 6; attempt++) {
    const code = makeCode();
    const { data, error } = await supabase
      .from("sessions").insert({ code, host_id: uid, status: "lobby", name, visibility, max_players: 4 })
      .select("*").single();
    if (error) { if (error.code === "23505") continue; throw error; }
    const session = data as SessionRow;
    const { error: pErr } = await supabase.from("session_players").insert({
      session_id: session.id, user_id: uid, seat: "player1",
      display_name: getName(), is_ai: false, ready: false,
    });
    if (pErr) throw pErr;
    return { session, seat: "player1" };
  }
  throw new Error("Could not generate a unique join code — try again.");
}

// Join by 5-char code (works for public or private lobbies).
export async function joinSession(rawCode: string): Promise<{ session: SessionRow; seat: Seat }> {
  const code = rawCode.trim().toUpperCase();
  const { data: sRow, error } = await supabase.from("sessions").select("*").eq("code", code).maybeSingle();
  if (error) throw error;
  if (!sRow) throw new Error("No lobby found with that code.");
  const session = sRow as SessionRow;
  if (session.status !== "lobby") throw new Error("That game has already started.");
  const seat = await claimFreeSeat(session);
  return { session, seat };
}

// Join a public lobby from the server browser by id.
export async function joinPublicLobby(sessionId: string): Promise<{ session: SessionRow; seat: Seat }> {
  const session = await fetchSession(sessionId);
  if (!session) throw new Error("That lobby no longer exists.");
  if (session.status !== "lobby") throw new Error("That game has already started.");
  const seat = await claimFreeSeat(session);
  return { session, seat };
}

/* ---------------- seat / nation / ready ---------------- */
export async function switchSeat(sessionId: string, seat: Seat): Promise<boolean> {
  const { error } = await supabase.from("session_players").update({ seat })
    .eq("session_id", sessionId).eq("user_id", getUid());
  if (error) { if (error.code === "23505") return false; throw error; }
  return true;
}
export async function chooseNation(sessionId: string, nation: string): Promise<void> {
  const { error } = await supabase.from("session_players").update({ nation, ready: false })
    .eq("session_id", sessionId).eq("user_id", getUid());
  if (error) throw error;
}
export async function setReady(sessionId: string, ready: boolean): Promise<void> {
  const { error } = await supabase.from("session_players").update({ ready })
    .eq("session_id", sessionId).eq("user_id", getUid());
  if (error) throw error;
}

/* ---------------- leave ---------------- */
export async function leaveSession(sessionId: string): Promise<void> {
  const uid = getUid();
  const players = await fetchPlayers(sessionId);
  await supabase.from("session_players").delete().eq("session_id", sessionId).eq("user_id", uid);
  const session = await fetchSession(sessionId);
  if (session && session.host_id === uid) {
    const nextHuman = players.find((p) => p.user_id !== uid && !p.is_ai);
    if (nextHuman) await supabase.from("sessions").update({ host_id: nextHuman.user_id }).eq("id", sessionId);
  }
}

/* ---------------- host: fill AI + start ---------------- */
const AI_NATIONS: Record<Seat, string> = { player1: "germany", player2: "britain", player3: "france", player4: "russia" };
export async function startGame(sessionId: string): Promise<void> {
  const roster = await fetchPlayers(sessionId);
  const taken = new Set(roster.map((p) => p.seat));
  const aiRows = SEATS.filter((s) => !taken.has(s)).map((seat) => ({
    session_id: sessionId, user_id: `ai-${seat}`, seat, nation: AI_NATIONS[seat],
    display_name: `${SEAT_INFO[seat].name} (AI)`, is_ai: true, ready: true,
  }));
  if (aiRows.length) {
    const { error } = await supabase.from("session_players").insert(aiRows);
    if (error && error.code !== "23505") throw error;
  }

  // Re-read the full roster (humans + freshly inserted AI) and seed the shared world.
  const full = await fetchPlayers(sessionId);
  const factionMeta: Record<string, MPPlayerMeta> = {};
  const stance: Record<string, Stance> = {};
  for (const p of full) {
    const faction = SEAT_FACTION[p.seat]; if (!faction) continue;
    factionMeta[faction] = {
      name: p.display_name || SEAT_INFO[p.seat].name,
      isAi: p.is_ai,
      nation: p.nation,
    };
    stance[faction] = (p.stance as Stance) || "balanced";
  }
  const world = seedMPWorld(factionMeta, stance);   // host is the world authority from here

  const { error: uErr } = await supabase.from("sessions")
    .update({ status: "active", world, last_turn_at: new Date().toISOString(), tick: 0 })
    .eq("id", sessionId);
  if (uErr) throw uErr;
}

export function allReady(players: PlayerRow[]): boolean {
  if (players.length === 0) return false;
  return players.every((p) => p.is_ai || (p.ready && !!p.nation));
}

/* ---------------- realtime ---------------- */
export function subscribeLobby(
  sessionId: string, onPlayers: () => void, onSession: (s: SessionRow) => void
): RealtimeChannel {
  return supabase.channel(`lobby:${sessionId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "session_players", filter: `session_id=eq.${sessionId}` }, () => onPlayers())
    .on("postgres_changes", { event: "UPDATE", schema: "public", table: "sessions", filter: `id=eq.${sessionId}` }, (p) => onSession(p.new as SessionRow))
    .subscribe();
}