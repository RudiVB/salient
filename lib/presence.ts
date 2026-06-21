// lib/presence.ts — Realtime presence for a match: who is actually connected.
// Each client tracks its seat/faction/name on a presence channel; everyone gets
// the live list of online players (used to show online dots + join/leave alerts).
"use client";
import { supabase } from "@/lib/supabase";
import type { RealtimeChannel } from "@supabase/supabase-js";

export interface PresenceMeta { uid: string; seat: string; faction: string; name: string; }

// Join the match's presence channel, broadcast `me`, and call onChange with the
// de-duplicated list of currently-online players whenever it changes.
export function joinPresence(
  sessionId: string,
  me: PresenceMeta,
  onChange: (online: PresenceMeta[]) => void
): RealtimeChannel {
  const channel = supabase.channel(`presence:${sessionId}`, {
    config: { presence: { key: me.uid } },
  });

  const emit = () => {
    const state = channel.presenceState() as Record<string, PresenceMeta[]>;
    const list: PresenceMeta[] = [];
    const seen = new Set<string>();
    for (const k in state) {
      for (const p of state[k]) {
        if (p && p.faction && !seen.has(p.faction)) { seen.add(p.faction); list.push(p); }
      }
    }
    onChange(list);
  };

  channel
    .on("presence", { event: "sync" }, emit)
    .on("presence", { event: "join" }, emit)
    .on("presence", { event: "leave" }, emit)
    .subscribe(async (status) => { if (status === "SUBSCRIBED") await channel.track(me); });

  return channel;
}