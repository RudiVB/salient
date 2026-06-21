// lib/campaign.ts — generate a bottom→top battle ladder for a front (territory).

import { CATALOG } from "@/lib/catalog";

export interface EnemyUnit { defId: string; troops: number; }
export interface Rung { idx: number; name: string; enemy: EnemyUnit[]; strength: number; reward: number; }

// rough combat power of a regiment
export function unitPower(defId: string, troops: number): number {
  const c = CATALOG[defId]; if (!c) return troops / 1000;
  return (troops / 1000) * ((c.atk + c.hp) / 2);
}
export function armyPower(units: { defId: string; troops: number }[]): number {
  return Math.round(units.reduce((s, u) => s + unitPower(u.defId, u.troops), 0));
}

// ---- VETERANCY ----
export const VET_MAX = 5;
export const VET_BONUS = 0.12;            // +12% power per veterancy level
export function vetMult(vet = 0): number { return 1 + Math.min(VET_MAX, vet) * VET_BONUS; }
export function unitPowerVet(defId: string, troops: number, vet = 0): number {
  return unitPower(defId, troops) * vetMult(vet);
}
// army power that counts each regiment's veterancy (use for the player's deployed force)
export function armyPowerVet(units: { defId: string; troops: number; vet?: number }[]): number {
  return Math.round(units.reduce((s, u) => s + unitPowerVet(u.defId, u.troops, u.vet || 0), 0));
}

// ---- COMMANDER RANK (driven by total wins) ----
export const RANKS = [
  { name: "Lieutenant", min: 0 },
  { name: "Captain", min: 3 },
  { name: "Major", min: 7 },
  { name: "Colonel", min: 12 },
  { name: "Brigadier", min: 18 },
  { name: "General", min: 26 },
  { name: "Field Marshal", min: 36 },
];
export interface RankInfo { index: number; name: string; min: number; nextMin: number | null; nextName: string | null; }
export function rankFor(wins: number): RankInfo {
  let idx = 0;
  for (let i = 0; i < RANKS.length; i++) if (wins >= RANKS[i].min) idx = i;
  const next = RANKS[idx + 1];
  return { index: idx, name: RANKS[idx].name, min: RANKS[idx].min, nextMin: next ? next.min : null, nextName: next ? next.name : null };
}
// stronger units require a higher rank to recruit (by rarity).
// nation signature units are always available to their own nation.
export function unitReqRank(defId: string): number {
  const c = CATALOG[defId]; if (!c) return 0;
  if (c.nation) return 0;
  return c.rarity === "legendary" ? 4 : c.rarity === "elite" ? 2 : c.rarity === "rare" ? 1 : 0;
}

// money price to recruit a fresh full-strength regiment
export function recruitPrice(defId: string): number {
  const c = CATALOG[defId]; if (!c) return 500;
  return Math.round(unitPower(defId, c.maxTroops) * 0.5);
}

const RUNG_NAMES = ["Forward Trenches", "The Wire", "Strongpoint", "The Ridge", "The Redoubt", "Enemy HQ"];
const POOL = ["rifleman", "grenadier", "guard", "mortar", "fieldgun", "storm", "tank", "gas", "sniper", "howitzer"];

// build a bot army roughly matched to a target power (difficulty 1 easy .. 3 hard)
export function genSkirmishArmy(targetPower: number, difficulty = 2): EnemyUnit[] {
  const want = Math.max(120, targetPower * (0.65 + difficulty * 0.28));
  const army: EnemyUnit[] = [];
  let guard = 0;
  while (armyPower(army) < want && guard++ < 14) {
    const def = POOL[Math.floor(Math.random() * POOL.length)];
    const base = CATALOG[def].maxTroops;
    const troops = Math.max(300, Math.round(base * (0.4 + Math.random() * 0.5)));
    army.push({ defId: def, troops });
  }
  return army.length ? army : [{ defId: "rifleman", troops: 3000 }];
}

function hash(s: string) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }

/** difficulty: 1 (easy) .. 3 (hard). scale: global escalation (1 + regions owned).
 *  Seeded by territory id so a front is stable. */
export function genFront(territoryId: string, difficulty = 2, scale = 1): Rung[] {
  let seed = hash(territoryId) ^ (difficulty * 2654435761);
  const rng = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const dmult = (0.7 + difficulty * 0.35) * scale;       // escalates as you conquer more
  const rungs: Rung[] = [];
  for (let i = 0; i < RUNG_NAMES.length; i++) {
    const tier = 1 + i * 0.45;                       // each rung tougher
    const n = 2 + Math.floor(rng() * 3);             // 2-4 enemy regiments
    const enemy: EnemyUnit[] = [];
    for (let k = 0; k < n; k++) {
      const def = POOL[Math.floor(rng() * POOL.length)];
      const base = CATALOG[def].maxTroops;
      const troops = Math.max(200, Math.round(base * (0.35 + tier * 0.22) * dmult * (0.7 + rng() * 0.6)));
      enemy.push({ defId: def, troops });
    }
    const strength = armyPower(enemy);
    const reward = Math.round((strength * 0.9 + 60 * (i + 1)) * scale);   // richer fronts later
    rungs.push({ idx: i, name: RUNG_NAMES[i], enemy, strength, reward });
  }
  return rungs;
}
