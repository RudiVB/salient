// lib/auth.ts — unified identity for Salient.
// Logged-in users use their Supabase Auth id; guests use a stable localStorage id.
// One currentUid()/displayName() that the whole app (lobby, saves) reads from.
"use client";
import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

/* ---------------- module-level cache (kept fresh by onAuthStateChange) ------- */
let _userId: string | null = null;     // auth user id when logged in, else null
let _username: string | null = null;   // profile username when known
let _initStarted = false;              // guard so we only subscribe once
const listeners = new Set<() => void>();
function emit() { listeners.forEach((fn) => fn()); }

/* ---------------- guest identity (localStorage) ------------------------------ */
const UID_KEY = "salient_uid";
const NAME_KEY = "salient_name";

export function guestUid(): string {
  if (typeof window === "undefined") return "ssr";
  let id = localStorage.getItem(UID_KEY);
  if (!id) { id = crypto.randomUUID(); localStorage.setItem(UID_KEY, id); }
  return id;
}
export function setLocalName(n: string): void {
  if (typeof window !== "undefined") localStorage.setItem(NAME_KEY, n.slice(0, 20) || "Commander");
}
function localName(): string {
  if (typeof window === "undefined") return "Commander";
  return localStorage.getItem(NAME_KEY) || "Commander";
}

/* ---------------- public accessors ------------------------------------------ */
// The id used for sessions/session_players/saves. Auth id wins; guest id otherwise.
export function currentUid(): string { return _userId || guestUid(); }
// Friendly name: profile username > locally typed name > "Commander".
export function displayName(): string { return _username || localName(); }
export function isLoggedIn(): boolean { return !!_userId; }
export function authUserId(): string | null { return _userId; }

/* ---------------- init + subscription --------------------------------------- */
// Idempotent: pulls the current session, then listens for sign-in/out changes.
export function initAuth(): void {
  if (_initStarted || typeof window === "undefined") return;
  _initStarted = true;

  supabase.auth.getSession().then(({ data }) => {
    applyUser(data.session?.user?.id || null);
  });

  supabase.auth.onAuthStateChange((_event, session) => {
    applyUser(session?.user?.id || null);
  });
}

// Update the cache for a (possibly null) user id and load their username.
async function applyUser(id: string | null) {
  _userId = id;
  if (!id) { _username = null; emit(); return; }
  try {
    const { data } = await supabase.from("profiles").select("username").eq("id", id).maybeSingle();
    _username = (data?.username as string) || _username || localName();
  } catch { _username = _username || localName(); }
  emit();
}

/* ---------------- auth actions ---------------------------------------------- */
export interface AuthResult { ok: boolean; needsConfirm?: boolean; error?: string; }

// Register: creates the auth user, then a profile row with the chosen username.
export async function signUp(email: string, password: string, username: string): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
  if (error) return { ok: false, error: error.message };
  setLocalName(username);
  // If email confirmation is OFF, we get a session immediately and can write the profile.
  if (data.session?.user) {
    await upsertProfile(data.session.user.id, username);
    await applyUser(data.session.user.id);
    return { ok: true };
  }
  // Confirmation required: no session yet. Profile is written on first sign-in.
  return { ok: true, needsConfirm: true };
}

// Login: signs in, then ensures a profile row exists with the stored username.
export async function signIn(email: string, password: string): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
  if (error) return { ok: false, error: error.message };
  if (data.user) {
    await upsertProfile(data.user.id, displayName());
    await applyUser(data.user.id);
  }
  return { ok: true };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
  await applyUser(null);
}

// Create or update the caller's profile row (RLS allows only self).
export async function upsertProfile(id: string, username: string): Promise<void> {
  setLocalName(username);
  await supabase.from("profiles").upsert({ id, username: username.slice(0, 20) }, { onConflict: "id" });
  if (id === _userId) { _username = username; emit(); }
}

/* ---------------- React hook ------------------------------------------------ */
// Subscribe a component to auth state. Returns identity + a loading flag.
export function useAuth() {
  const [, force] = useState(0);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    initAuth();
    const cb = () => { force((n) => n + 1); setLoading(false); };
    listeners.add(cb);
    // resolve initial loading once the first session check returns
    supabase.auth.getSession().then(() => setLoading(false));
    return () => { listeners.delete(cb); };
  }, []);
  return {
    loading,
    userId: _userId,
    loggedIn: !!_userId,
    username: _username,
    name: displayName(),
  };
}