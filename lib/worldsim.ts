/**
 * Living world simulation — AI factions that fight and expand (Pillar 3).
 * lib/worldsim.ts
 *
 * Territory ownership becomes a persistent faction map with garrisons. Each
 * "turn" the AI powers reinforce and attack their neighbours (including the
 * player), so the map genuinely changes over the campaign.
 */
import { TERRITORIES, TERRITORY, NATION_HOME, latLonToXYZ } from "@/lib/world";

export interface Faction { id: string; name: string; color: string; ai: boolean; aggression: number; boldness: number; }
export const AI_FACTIONS: Faction[] = [
  { id: "crimson", name: "Crimson Empire",  color: "#e5414f", ai: true, aggression: 0.92, boldness: 0.50 }, // warlike, attacks on slim odds
  { id: "azure",   name: "Azure Coalition", color: "#56b9cf", ai: true, aggression: 0.70, boldness: 0.58 }, // measured
  { id: "gold",    name: "Gold Federation", color: "#f0c860", ai: true, aggression: 0.85, boldness: 0.52 }, // expansionist
  { id: "verdant", name: "Verdant League",  color: "#67c98a", ai: true, aggression: 0.55, boldness: 0.64 }, // cautious, only safe attacks
];
export const PLAYER_FACTION = "player";
export const PLAYER_COLOR = "#ffffff";   // player territories drawn bright/white-tinted

export interface WorldState {
  tick: number;
  owner: Record<string, string>;     // territoryId -> factionId
  garrison: Record<string, number>;  // territoryId -> strength
  log: string[];                     // recent events (newest first)
  lastTurnAt: number;                // ms timestamp of the last resolved turn (real-time clock)
}

// great-circle-ish distance between two territories (for clustering)
function dist(aId: string, bId: string): number {
  const a = TERRITORY[aId], b = TERRITORY[bId]; if (!a || !b) return 1e9;
  const [ax, ay, az] = latLonToXYZ(a.lat, a.lon, 1), [bx, by, bz] = latLonToXYZ(b.lat, b.lon, 1);
  return Math.hypot(ax - bx, ay - by, az - bz);
}

function hash(s: string): number { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

// seed the world: player holds only their home; AI factions get clustered empires
export function seedWorld(nationId: string | null): WorldState {
  const home = (nationId && NATION_HOME[nationId]) || "france";
  // AI capitals spread around the globe (skip the player's home region)
  const capWanted: Record<string, string> = { crimson: "germany", azure: "britain", gold: "russia_w", verdant: "india" };
  const caps: { f: string; t: string }[] = [];
  for (const f of AI_FACTIONS) {
    let cap = capWanted[f.id];
    if (cap === home || caps.some((c) => c.t === cap)) cap = TERRITORIES.find((t) => t.id !== home && !caps.some((c) => c.t === t.id))?.id || cap;
    caps.push({ f: f.id, t: cap });
  }
  const owner: Record<string, string> = {}; const garrison: Record<string, number> = {};
  for (const t of TERRITORIES) {
    if (t.id === home) { owner[t.id] = PLAYER_FACTION; garrison[t.id] = 8; continue; }
    // assign to the nearest AI capital
    let best = caps[0].f, bestD = Infinity;
    for (const c of caps) { const d = dist(t.id, c.t); if (d < bestD) { bestD = d; best = c.f; } }
    owner[t.id] = best;
    const isCap = caps.some((c) => c.t === t.id);
    garrison[t.id] = isCap ? 9 : 3 + (hash(t.id) % 5);   // 3..7, capitals stronger
  }
  return { tick: 0, owner, garrison, log: ["The war begins. Four great powers carve up the world."], lastTurnAt: Date.now() };
}

// migrate: build a world from an older save that only had `owned`
export function worldFromOwned(nationId: string | null, owned: string[]): WorldState {
  const w = seedWorld(nationId);
  for (const id of owned || []) if (w.owner[id] !== undefined) { w.owner[id] = PLAYER_FACTION; w.garrison[id] = Math.max(w.garrison[id], 6); }
  return w;
}

export const factionColor = (id: string) => id === PLAYER_FACTION ? PLAYER_COLOR : (AI_FACTIONS.find((f) => f.id === id)?.color || "#888");
export const factionName = (id: string, playerName: string) => id === PLAYER_FACTION ? playerName : (AI_FACTIONS.find((f) => f.id === id)?.name || id);

export function territoryCounts(w: WorldState): Record<string, number> {
  const c: Record<string, number> = {};
  for (const id in w.owner) c[w.owner[id]] = (c[w.owner[id]] || 0) + 1;
  return c;
}

// colour map for the globe
export function colorMapOf(w: WorldState, playerAccent: string): Record<string, string> {
  const m: Record<string, string> = {};
  for (const id in w.owner) m[id] = w.owner[id] === PLAYER_FACTION ? playerAccent : factionColor(w.owner[id]);
  return m;
}

/**
 * Advance the world one turn. AI factions reinforce a border region and may
 * launch one attack each against a weaker neighbour (AI or player).
 * Returns a NEW state plus a list of human-readable events.
 * The player never auto-attacks; player losses are reported so the UI can react.
 */
/**
 * Advance the world one turn with smarter AI:
 *  - reinforce the most-threatened border region (concentrate defence)
 *  - launch up to several attacks per turn for larger empires
 *  - only attack at favourable odds (per-faction boldness)
 *  - prefer weak targets and gang up on the current leader (self-balancing)
 * Returns a NEW state plus human-readable events.
 */
export function worldTick(w: WorldState, playerName: string, playerDefense = 0, rng: () => number = Math.random): { state: WorldState; events: string[]; lostByPlayer: string[] } {
  const owner = { ...w.owner }; const garrison = { ...w.garrison };
  const events: string[] = []; const lostByPlayer: string[] = [];
  const grace = w.tick < PLAYER_GRACE;

  const garr = (id: string) => garrison[id] || 0;
  const defOf = (id: string) => garr(id) + (owner[id] === PLAYER_FACTION ? playerDefense : 0);

  for (const f of AI_FACTIONS) {
    const mine = TERRITORIES.filter((t) => owner[t.id] === f.id);
    if (mine.length === 0) continue;

    // current leader (most regions) — everyone leans on them
    const counts = territoryCounts({ ...w, owner });
    let leaderId = PLAYER_FACTION, leaderN = -1;
    for (const k in counts) if (counts[k] > leaderN) { leaderN = counts[k]; leaderId = k; }

    // ---- threat-based reinforcement: shore up the weakest exposed border ----
    let worst: string | null = null, worstGap = -Infinity;
    for (const t of mine) {
      let maxEnemy = 0;
      for (const n of t.neighbors) if (owner[n] !== f.id) maxEnemy = Math.max(maxEnemy, defOf(n));
      if (maxEnemy === 0) continue;                       // interior region, safe
      const gap = maxEnemy - garr(t.id);                  // how outgunned this border is
      if (gap > worstGap) { worstGap = gap; worst = t.id; }
    }
    const reinforceTarget = worst || mine[Math.floor(rng() * mine.length)].id;
    garrison[reinforceTarget] = garr(reinforceTarget) + 1 + (rng() < f.aggression * 0.5 ? 1 : 0);

    // ---- attacks: stronger empires can act multiple times ----
    const maxAttacks = Math.min(3, 1 + Math.floor(mine.length / 6));
    const used = new Set<string>();                       // a region can attack / be hit once per turn
    for (let a = 0; a < maxAttacks; a++) {
      let best: { from: string; to: string; odds: number; score: number } | null = null;
      for (const t of mine) {
        if (used.has(t.id) || garr(t.id) < 3) continue;
        for (const n of t.neighbors) {
          if (owner[n] === f.id || used.has(n)) continue;
          if (grace && owner[n] === PLAYER_FACTION) continue;
          const atk = garr(t.id), def = defOf(n);
          const odds = atk / (atk + def + 0.001);
          if (odds < f.boldness) continue;                // too risky for this faction
          const weakBonus = def <= 2 ? 0.25 : 0;
          const leaderBonus = owner[n] === leaderId && leaderId !== f.id ? 0.35 : 0;  // gang up on #1
          const score = odds * 2 + weakBonus + leaderBonus + rng() * 0.1;
          if (!best || score > best.score) best = { from: t.id, to: n, odds, score };
        }
      }
      if (!best) break;
      if (rng() > f.aggression) break;                    // restraint
      used.add(best.from); used.add(best.to);
      const atk = garr(best.from);
      if (rng() < best.odds * 0.95) {
        const prev = owner[best.to];
        owner[best.to] = f.id;
        garrison[best.to] = Math.max(1, Math.floor(atk * 0.5));
        garrison[best.from] = Math.max(1, Math.floor(atk * 0.4));
        const toName = TERRITORY[best.to].name;
        if (prev === PLAYER_FACTION) { events.push(`⚠ ${f.name} captured ${toName} from you!`); lostByPlayer.push(best.to); }
        else events.push(`${f.name} took ${toName} from ${factionName(prev, playerName)}.`);
      } else {
        garrison[best.from] = Math.max(1, atk - 1 - Math.floor(defOf(best.to) * 0.3));
      }
    }
  }

  const log = [...events, ...w.log].slice(0, 14);
  return { state: { tick: w.tick + 1, owner, garrison, log, lastTurnAt: w.lastTurnAt }, events, lostByPlayer };
}

// advance several turns at once (offline catch-up / background). Aggregates events.
export function advanceTurns(w: WorldState, playerName: string, playerDefense: number, n: number): { state: WorldState; events: string[]; lostByPlayer: string[] } {
  let s = w; const events: string[] = []; const lost: string[] = [];
  for (let i = 0; i < n; i++) { const r = worldTick(s, playerName, playerDefense); s = r.state; events.push(...r.events); lost.push(...r.lostByPlayer); }
  return { state: s, events, lostByPlayer: lost };
}

// the enemy (non-player) territories adjacent to any player territory
export function attackableSet(w: WorldState): Set<string> {
  const set = new Set<string>();
  for (const t of TERRITORIES) {
    if (w.owner[t.id] !== PLAYER_FACTION) continue;
    for (const n of t.neighbors) if (w.owner[n] !== PLAYER_FACTION) set.add(n);
  }
  return set;
}

// AI leaves the player alone for the first few turns
export const PLAYER_GRACE = 3;
// share of the world needed to win
export const DOMINATION = 0.6;

export function worldOutcome(w: WorldState): "victory" | "defeat" | null {
  const c = territoryCounts(w); const p = c[PLAYER_FACTION] || 0; const total = TERRITORIES.length;
  if (p <= 0) return "defeat";
  if (p >= Math.ceil(total * DOMINATION)) return "victory";
  return null;
}
