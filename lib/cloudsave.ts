// lib/cloudsave.ts — mirror the local game save (localStorage) to Supabase.
// Logged-in users get a cloud save (one row per user in `saves`); guests stay local.
"use client";
import { supabase } from "@/lib/supabase";

// MUST match SAVE_KEY in lib/store.tsx so we read/write the same blob.
export const SAVE_KEY = "ww1-autobattle-save-v2";

/* ---------------- local helpers ---------------- */
export function readLocalSave(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(SAVE_KEY);
}
export function writeLocalSave(json: string): void {
  if (typeof window !== "undefined") localStorage.setItem(SAVE_KEY, json);
}

/* ---------------- cloud read/write ---------------- */
// Returns the saved game object (parsed) or null if the user has no cloud save.
export async function loadCloudSave(userId: string): Promise<unknown | null> {
  const { data, error } = await supabase
    .from("saves").select("data").eq("user_id", userId).maybeSingle();
  if (error) throw error;
  return data?.data ?? null;
}

// Upsert the user's cloud save with the current local blob.
export async function saveCloudSave(userId: string, dataObj: unknown): Promise<void> {
  const { error } = await supabase
    .from("saves")
    .upsert({ user_id: userId, data: dataObj, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw error;
}