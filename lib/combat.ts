// lib/combat.ts — tactical combat model for World Conquest.
// Replaces the naive power roll with: unit counters (rock-paper-scissors),
// combined-arms synergies, terrain modifiers, and a chosen battle tactic.

import { CATALOG, BRANCH, ROLE } from "@/lib/catalog";
import { unitPowerVet } from "@/lib/campaign";

export interface Unit { defId: string; troops: number; vet?: number; }

// ---- combat classes (for the counter triangle) ----
export type CClass = "infantry" | "armor" | "artillery" | "cavalry" | "gas" | "air" | "support";
export const CLASS_LABEL: Record<CClass, string> = {
  infantry: "Infantry", armor: "Armour", artillery: "Artillery",
  cavalry: "Cavalry", gas: "Gas", air: "Air", support: "Support",
};
export function unitClass(defId: string): CClass {
  const c = CATALOG[defId]; if (!c) return "infantry";
  if (c.kind === "medic") return "support";
  if (c.kind === "gas") return "gas";
  if (c.kind === "tank") return "armor";
  if (c.kind === "car") return "cavalry";
  if (c.kind === "plane") return "air";
  if (c.kind === "artillery") return "artillery";
  return "infantry";
}

// attacker class -> multiplier vs the enemy's DOMINANT class (>1 strong, <1 weak)
const COUNTER: Record<CClass, Partial<Record<CClass, number>>> = {
  infantry:  { artillery: 1.30, armor: 0.78 },
  armor:     { infantry: 1.30, artillery: 0.78, gas: 0.85 },
  artillery: { armor: 1.28, infantry: 1.12, cavalry: 0.82, air: 0.80 },
  cavalry:   { artillery: 1.32, air: 1.10, infantry: 0.80 },
  gas:       { infantry: 1.28, artillery: 1.10, armor: 0.82 },
  air:       { artillery: 1.22, armor: 1.16, cavalry: 0.85 },
  support:   {},
};

// ---- terrain ----
export interface Terrain { id: string; name: string; blurb: string; mult: Partial<Record<CClass, number>>; }
export const TERRAINS: Terrain[] = [
  { id: "open",  name: "Open Ground",   blurb: "Armour and cavalry roam freely.",        mult: { armor: 1.18, cavalry: 1.18, infantry: 0.95 } },
  { id: "mud",   name: "Mud & Trenches", blurb: "Tanks bog down; infantry digs in.",     mult: { armor: 0.78, cavalry: 0.82, infantry: 1.15, artillery: 1.08 } },
  { id: "ridge", name: "The Ridge",      blurb: "High ground favours the guns.",          mult: { artillery: 1.25, infantry: 1.05, cavalry: 0.85 } },
  { id: "forest", name: "Shattered Wood", blurb: "Cover for infantry, death for armour.", mult: { infantry: 1.18, armor: 0.80, cavalry: 0.80, gas: 1.1 } },
  { id: "urban", name: "Urban Ruins",    blurb: "Close-quarters grind.",                  mult: { infantry: 1.15, artillery: 1.12, armor: 0.9, cavalry: 0.8 } },
];
export function terrainFor(seedId: string): Terrain {
  let h = 2166136261; for (let i = 0; i < seedId.length; i++) { h ^= seedId.charCodeAt(i); h = Math.imul(h, 16777619); }
  return TERRAINS[(h >>> 0) % TERRAINS.length];
}

// ---- tactics (pick one before battle) ----
export interface Tactic {
  id: string; name: string; desc: string;
  power: (own: Unit[], foe: Unit[]) => number;   // power multiplier
  casualty: number;                               // own-casualty multiplier
  needs?: CClass;                                 // class required to shine
}
const has = (u: Unit[], cls: CClass) => u.some((x) => x.troops > 0 && unitClass(x.defId) === cls);
export const TACTICS: Tactic[] = [
  { id: "assault", name: "Frontal Assault", desc: "+20% power, but you take heavier losses.", power: () => 1.20, casualty: 1.3 },
  { id: "barrage", name: "Creeping Barrage", desc: "+30% if you field artillery; softens the enemy.", power: (o) => has(o, "artillery") ? 1.30 : 0.98, casualty: 0.95, needs: "artillery" },
  { id: "flank",   name: "Flanking Manoeuvre", desc: "+28% with armour or cavalry to turn their line.", power: (o) => (has(o, "armor") || has(o, "cavalry")) ? 1.28 : 0.98, casualty: 1.0, needs: "cavalry" },
  { id: "dig_in",  name: "Dig In",         desc: "−8% power, but greatly reduced casualties.", power: () => 0.92, casualty: 0.6 },
  { id: "combined", name: "Combined Push", desc: "+15% if you bring 3+ branches.", power: (o) => branches(o) >= 3 ? 1.15 : 1.0, casualty: 0.95 },
];
function branches(u: Unit[]) { const s = new Set(u.filter((x) => x.troops > 0).map((x) => CATALOG[x.defId]?.branch)); return s.size; }

// ---- composition + synergies ----
export function dominantClass(units: Unit[]): CClass {
  const by: Partial<Record<CClass, number>> = {};
  for (const u of units) { if (u.troops <= 0) continue; const k = unitClass(u.defId); by[k] = (by[k] || 0) + unitPowerVet(u.defId, u.troops, u.vet || 0); }
  let best: CClass = "infantry", bestv = -1;
  (Object.keys(by) as CClass[]).forEach((k) => { if ((by[k] || 0) > bestv) { bestv = by[k] || 0; best = k; } });
  return best;
}
export function classBreakdown(units: Unit[]): { cls: CClass; pct: number }[] {
  const by: Partial<Record<CClass, number>> = {}; let total = 0;
  for (const u of units) { if (u.troops <= 0) continue; const k = unitClass(u.defId); const p = unitPowerVet(u.defId, u.troops, u.vet || 0); by[k] = (by[k] || 0) + p; total += p; }
  return (Object.keys(by) as CClass[]).map((k) => ({ cls: k, pct: total ? (by[k] || 0) / total : 0 })).sort((a, b) => b.pct - a.pct);
}
export interface Synergy { label: string; }
export function activeSynergies(units: Unit[]): Synergy[] {
  const byBranch: Record<string, number> = {}, byRole: Record<string, number> = {};
  for (const u of units) { const c = CATALOG[u.defId]; if (!c || u.troops <= 0) continue; byBranch[c.branch] = (byBranch[c.branch] || 0) + 1; byRole[c.role] = (byRole[c.role] || 0) + 1; }
  const out: Synergy[] = [];
  const scan = (defs: typeof BRANCH, counts: Record<string, number>) => {
    for (const key in counts) { const d = defs[key]; if (!d) continue; let best = null as null | { n: number }; for (const t of d.tiers) if (counts[key] >= t.n) best = t; if (best) out.push({ label: d.note }); }
  };
  scan(BRANCH, byBranch); scan(ROLE, byRole);
  return out;
}
function synergyMult(units: Unit[]): number {
  const byBranch: Record<string, number> = {}, byRole: Record<string, number> = {};
  for (const u of units) { const c = CATALOG[u.defId]; if (!c || u.troops <= 0) continue; byBranch[c.branch] = (byBranch[c.branch] || 0) + 1; byRole[c.role] = (byRole[c.role] || 0) + 1; }
  let atkPct = 0, hp = 0;
  const scan = (defs: typeof BRANCH, counts: Record<string, number>) => {
    for (const key in counts) { const d = defs[key]; if (!d) continue; let best = null as null | { atkPct?: number; hp?: number; n: number }; for (const t of d.tiers) if (counts[key] >= t.n) best = t; if (best) { atkPct += best.atkPct || 0; hp += best.hp || 0; } }
  };
  scan(BRANCH, byBranch); scan(ROLE, byRole);
  return 1 + atkPct * 0.6 + hp / 4000;
}

// ---- effective power of a side (counters + terrain + synergy + tactic) ----
export function effectivePower(own: Unit[], foe: Unit[], terrain?: Terrain | null, tactic?: Tactic | null): number {
  const foeDom = dominantClass(foe);
  let p = 0;
  for (const u of own) {
    if (u.troops <= 0) continue;
    const cls = unitClass(u.defId);
    let up = unitPowerVet(u.defId, u.troops, u.vet || 0);
    up *= COUNTER[cls]?.[foeDom] ?? 1;            // counter the enemy's dominant arm
    if (terrain) up *= terrain.mult[cls] ?? 1;    // terrain
    p += up;
  }
  p *= synergyMult(own);                          // combined arms
  if (tactic) p *= tactic.power(own, foe);        // chosen tactic
  return p;
}

export interface CombatResult { won: boolean; factor: number; pEff: number; eEff: number; winChance: number; }
export function resolveCombat(player: Unit[], enemy: Unit[], terrain?: Terrain | null, tactic?: Tactic | null): CombatResult {
  const pEff = effectivePower(player, enemy, terrain, tactic);
  const eEff = effectivePower(enemy, player, terrain, null);   // enemy gets terrain + counters, no tactic
  const roll = pEff * (0.85 + Math.random() * 0.32);
  const won = roll >= eEff;
  const ratio = eEff / Math.max(1, pEff);
  let f = won ? 0.10 : 0.30;
  f *= Math.min(2, Math.max(0.6, ratio));         // bigger gap = more casualties (rout)
  if (tactic) f *= tactic.casualty;
  f = Math.min(0.9, Math.max(0.04, f));
  const winChance = Math.round(Math.min(96, Math.max(4, (pEff / (pEff + eEff)) * 100)));
  return { won, factor: f, pEff: Math.round(pEff), eEff: Math.round(eEff), winChance };
}

// casualty factor for an outcome decided elsewhere (e.g. BattleScene interactive mode).
// effortPct (0..~48) = sum of ability efforts the player spent — boosts power and cuts losses.
export function casualtyFactor(player: Unit[], enemy: Unit[], terrain: Terrain | null, tactic: Tactic | null, won: boolean, effortPct = 0): number {
  const pEff = effectivePower(player, enemy, terrain, tactic) * (1 + effortPct / 100);
  const eEff = effectivePower(enemy, player, terrain, null);
  const ratio = eEff / Math.max(1, pEff);
  let f = won ? 0.10 : 0.30;
  f *= Math.min(2, Math.max(0.6, ratio));            // bigger gap = more casualties (rout)
  if (tactic) f *= tactic.casualty;
  f *= (1 - Math.min(0.35, effortPct * 0.004));      // good ability use spares your men
  return Math.min(0.9, Math.max(0.04, f));
}

// quick advice string: what beats the enemy's dominant arm
export function counterHint(enemy: Unit[]): string {
  const dom = dominantClass(enemy);
  const best: Partial<Record<CClass, CClass>> = { armor: "infantry", infantry: "armor", artillery: "cavalry", cavalry: "infantry", gas: "armor", air: "artillery" };
  const rec = best[dom];
  return rec ? `Enemy is ${CLASS_LABEL[dom]}-heavy — bring ${CLASS_LABEL[rec]}.` : `Mixed enemy force.`;
}
