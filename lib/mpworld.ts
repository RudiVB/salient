// lib/mpworld.ts — the SHARED multiplayer world (stored in sessions.world jsonb).
// Four factions (crimson/azure/gold/verdant) map to the four lobby seats; each is
// driven by a human's stance or by AI. The host advances one turn at a time.
import { TERRITORIES, TERRITORY, latLonToXYZ } from "@/lib/world";
import { AI_FACTIONS } from "@/lib/worldsim";

export type FactionId = "crimson" | "azure" | "gold" | "verdant";
export const FACTION_IDS: FactionId[] = ["crimson", "azure", "gold", "verdant"];
// seat -> faction (must match SEAT_INFO in lib/lobby.ts)
export const SEAT_FACTION: Record<string, FactionId> = {
  player1: "crimson", player2: "azure", player3: "gold", player4: "verdant",
};
export const FACTION_COLOR: Record<FactionId, string> =
  Object.fromEntries(AI_FACTIONS.map((f) => [f.id, f.color])) as Record<FactionId, string>;
export const FACTION_LABEL: Record<FactionId, string> =
  Object.fromEntries(AI_FACTIONS.map((f) => [f.id, f.name])) as Record<FactionId, string>;

export type Stance = "aggressive" | "balanced" | "defensive";

export interface MPPlayerMeta { name: string; isAi: boolean; nation: string | null; }
export interface MPWorld {
  tick: number;
  owner: Record<string, FactionId>;        // territoryId -> faction
  garrison: Record<string, number>;        // territoryId -> strength
  log: string[];                           // newest first, capped
  players: Record<string, MPPlayerMeta>;   // factionId -> who controls it
  stance: Record<string, Stance>;          // factionId -> current stance
  lastTurnAt: number;                      // ms of last resolved turn
  paused: boolean;
}

/* ---------------- geometry helpers ---------------- */
function dist(aId: string, bId: string): number {
  const a = TERRITORY[aId], b = TERRITORY[bId]; if (!a || !b) return 1e9;
  const [ax, ay, az] = latLonToXYZ(a.lat, a.lon, 1), [bx, by, bz] = latLonToXYZ(b.lat, b.lon, 1);
  return Math.hypot(ax - bx, ay - by, az - bz);
}
function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

/* ---------------- seeding ---------------- */
const FACTION_CAPITAL: Record<FactionId, string> = {
  crimson: "germany", azure: "britain", gold: "russia_w", verdant: "india",
};

// Build the opening world: each faction gets a clustered empire around its capital.
export function seedMPWorld(players: Record<string, MPPlayerMeta>, stance: Record<string, Stance>): MPWorld {
  const owner: Record<string, FactionId> = {}; const garrison: Record<string, number> = {};
  for (const t of TERRITORIES) {
    let best: FactionId = "crimson", bestD = Infinity;
    for (const f of FACTION_IDS) { const d = dist(t.id, FACTION_CAPITAL[f]); if (d < bestD) { bestD = d; best = f; } }
    owner[t.id] = best;
    const isCap = FACTION_CAPITAL[owner[t.id]] === t.id;
    garrison[t.id] = isCap ? 10 : 3 + (hash(t.id) % 5);   // 3..7, capitals stronger
  }
  return {
    tick: 0, owner, garrison,
    log: ["The war begins. Four powers carve up the world."],
    players, stance, lastTurnAt: Date.now(), paused: false,
  };
}

/* ---------------- stance tuning ---------------- */
// Base behaviour per faction (flavour) before the controller's stance is applied.
const BASE: Record<FactionId, { aggression: number; boldness: number }> =
  Object.fromEntries(AI_FACTIONS.map((f) => [f.id, { aggression: f.aggression, boldness: f.boldness }])) as any;

function tuned(f: FactionId, stance: Stance) {
  const b = BASE[f];
  if (stance === "aggressive") return { aggression: Math.min(0.98, b.aggression * 1.25), boldness: b.boldness * 0.8, attacks: 1, garrison: 1 };
  if (stance === "defensive")  return { aggression: b.aggression * 0.55,                 boldness: Math.min(0.95, b.boldness * 1.25), attacks: 0, garrison: 2 };
  return { aggression: b.aggression, boldness: b.boldness, attacks: 0, garrison: 1 };   // balanced
}

/* ---------------- one turn ---------------- */
// Advance the shared world. stanceByFaction overrides world.stance (host-supplied
// from the latest session_players rows). Returns a NEW world + this turn's events.
export function mpTick(
  w: MPWorld,
  stanceByFaction: Record<string, Stance>,
  rng: () => number = Math.random
): { world: MPWorld; events: string[] } {
  const owner = { ...w.owner }; const garrison = { ...w.garrison };
  const events: string[] = [];
  const stance: Record<string, Stance> = { ...w.stance, ...stanceByFaction };

  const counts = countOf(owner);
  let leaderId: string = FACTION_IDS[0], leaderN = -1;
  for (const k of FACTION_IDS) if ((counts[k] || 0) > leaderN) { leaderN = counts[k] || 0; leaderId = k; }

  for (const f of FACTION_IDS) {
    const mine = TERRITORIES.filter((t) => owner[t.id] === f);
    if (mine.length === 0) continue;                          // eliminated
    const cfg = tuned(f, stance[f] || "balanced");

    // ---- reinforce the weakest exposed border ----
    let worst: string | null = null, worstGap = -Infinity;
    for (const t of mine) {
      let maxEnemy = 0;
      for (const n of t.neighbors) if (owner[n] !== f) maxEnemy = Math.max(maxEnemy, garrison[n] || 0);
      if (maxEnemy === 0) continue;
      const gap = maxEnemy - (garrison[t.id] || 0);
      if (gap > worstGap) { worstGap = gap; worst = t.id; }
    }
    const rt = worst || mine[Math.floor(rng() * mine.length)].id;
    garrison[rt] = (garrison[rt] || 0) + cfg.garrison + (rng() < cfg.aggression * 0.5 ? 1 : 0);

    // ---- attacks (defensive factions skip) ----
    const maxAttacks = Math.min(3, 1 + Math.floor(mine.length / 6)) + cfg.attacks;
    const used = new Set<string>();
    for (let a = 0; a < maxAttacks; a++) {
      let best: { from: string; to: string; odds: number; score: number } | null = null;
      for (const t of mine) {
        if (used.has(t.id) || (garrison[t.id] || 0) < 3) continue;
        for (const n of t.neighbors) {
          if (owner[n] === f || used.has(n)) continue;
          const atk = garrison[t.id] || 0, def = garrison[n] || 0;
          const odds = atk / (atk + def + 0.001);
          if (odds < cfg.boldness) continue;
          const weakBonus = def <= 2 ? 0.25 : 0;
          const leaderBonus = owner[n] === leaderId && leaderId !== f ? 0.35 : 0;   // gang up on #1
          const score = odds * 2 + weakBonus + leaderBonus + rng() * 0.1;
          if (!best || score > best.score) best = { from: t.id, to: n, odds, score };
        }
      }
      if (!best) break;
      if (rng() > cfg.aggression) break;
      used.add(best.from); used.add(best.to);
      const atk = garrison[best.from] || 0;
      if (rng() < best.odds * 0.95) {
        const prev = owner[best.to];
        owner[best.to] = f;
        garrison[best.to] = Math.max(1, Math.floor(atk * 0.5));
        garrison[best.from] = Math.max(1, Math.floor(atk * 0.4));
        events.push(`${nameOf(w, f)} took ${TERRITORY[best.to].name} from ${nameOf(w, prev)}.`);
      } else {
        garrison[best.from] = Math.max(1, atk - 1 - Math.floor((garrison[best.to] || 0) * 0.3));
      }
    }
  }

  const log = [...events, ...w.log].slice(0, 16);
  return {
    world: { ...w, tick: w.tick + 1, owner, garrison, log, stance, lastTurnAt: Date.now() },
    events,
  };
}

/* ---------------- read helpers ---------------- */
function countOf(owner: Record<string, string>): Record<string, number> {
  const c: Record<string, number> = {};
  for (const id in owner) c[owner[id]] = (c[owner[id]] || 0) + 1;
  return c;
}
export function nameOf(w: MPWorld, factionId: string): string {
  return w.players[factionId]?.name || FACTION_LABEL[factionId as FactionId] || factionId;
}

export interface Standing { factionId: FactionId; name: string; isAi: boolean; color: string; count: number; pct: number; stance: Stance; }
// Sorted desc by territory count, for the standings panel.
export function standings(w: MPWorld): Standing[] {
  const c = countOf(w.owner); const total = TERRITORIES.length;
  return FACTION_IDS.map((f) => ({
    factionId: f, name: nameOf(w, f), isAi: w.players[f]?.isAi ?? true,
    color: FACTION_COLOR[f], count: c[f] || 0, pct: Math.round(((c[f] || 0) / total) * 100),
    stance: w.stance[f] || "balanced",
  })).sort((a, b) => b.count - a.count);
}
// territory -> colour, for WorldGlobe's colorMap prop
export function colorMapOf(w: MPWorld): Record<string, string> {
  const m: Record<string, string> = {};
  for (const id in w.owner) m[id] = FACTION_COLOR[w.owner[id]];
  return m;
}
// match over when one faction holds 60%+ or only one remains
export function mpOutcome(w: MPWorld): FactionId | null {
  const c = countOf(w.owner); const total = TERRITORIES.length;
  const alive = FACTION_IDS.filter((f) => (c[f] || 0) > 0);
  if (alive.length === 1) return alive[0];
  for (const f of FACTION_IDS) if ((c[f] || 0) >= Math.ceil(total * 0.6)) return f;
  return null;
}