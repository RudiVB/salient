// lib/engine.ts — PURE, DETERMINISTIC game logic.
// This file has no DOM/Three deps, so it can run unchanged in a Supabase Edge
// Function / Vercel route to validate battles for real async PvP.

import { UNITS, CATALOG, BRANCH, ROLE, SynDef, Kind } from "@/lib/catalog";

export interface Instance { uid: string; id: string; pos: number; }

export interface Combatant {
  uid: string; id: string; pos: number; name: string;
  branch: string; role: string; kind: Kind; cost: number;
  atk: number; maxHp: number; hp: number;
}

export interface TraitView { name: string; color: string; count: number; active: boolean; nextN: number | null; note: string; }

export interface CombatEvent { atk: string; atkSide: "P" | "E"; atkKind: Kind; tgt: string; died: boolean; }
export interface CombatResult { winner: "P" | "E" | "D"; log: CombatEvent[]; }

const TICK_CAP = 80;

// ---- unique ids (module-local counter) ----
let _uid = 1;
export const uid = () => "u" + _uid++;
export const resetUid = () => { _uid = 1; };

const rnd = (n: number) => Math.floor(Math.random() * n);
const pick = <T,>(a: T[]) => a[rnd(a.length)];
const highestTier = (tiers: SynDef["tiers"], c: number) => {
  let b: SynDef["tiers"][number] | null = null;
  for (const t of tiers) if (c >= t.n) b = t;
  return b;
};

// Apply synergies to a list of instances -> buffed combatants + active traits + UI view.
export function computeStats(instances: Instance[]): {
  units: Combatant[];
  active: { name: string; key: string; def: SynDef; count: number; tier: any }[];
  traits: TraitView[];
} {
  const base = instances.map((it) => {
    const c = CATALOG[it.id];
    return { uid: it.uid, id: it.id, pos: it.pos, name: c.name, branch: c.branch, role: c.role,
             kind: c.kind, cost: c.cost, atk: c.atk, maxHp: c.hp } as any;
  });
  const uniq = (t: string, k: string) => new Set(base.filter((u: any) => u[k] === t).map((u: any) => u.id)).size;

  const active: any[] = [];
  let allAtk = 0;
  const collect = (defs: Record<string, SynDef>, key: string) => {
    for (const [name, def] of Object.entries(defs)) {
      const count = uniq(name, key);
      const tier = highestTier(def.tiers, count);
      if (tier) { active.push({ name, key, def, count, tier }); if (def.scope === "all" && tier.atkPct) allAtk += tier.atkPct; }
    }
  };
  collect(BRANCH, "branch"); collect(ROLE, "role");

  const units: Combatant[] = base.map((u: any) => {
    let atkPct = allAtk, hpAdd = 0;
    for (const a of active) {
      if (a.def.scope !== "self" || u[a.key] !== a.name) continue;
      if (a.tier.atkPct) atkPct += a.tier.atkPct;
      if (a.tier.hp) hpAdd += a.tier.hp;
    }
    const maxHp = Math.round(u.maxHp + hpAdd);
    return { ...u, atk: Math.round(u.atk * (1 + atkPct)), maxHp, hp: maxHp };
  });

  const traits: TraitView[] = [];
  const build = (defs: Record<string, SynDef>, key: string) => {
    for (const [name, def] of Object.entries(defs)) {
      const count = uniq(name, key);
      const tier = highestTier(def.tiers, count);
      const nx = def.tiers.find((t) => t.n > count);
      traits.push({ name, color: def.color, count, active: !!tier, nextN: nx ? nx.n : null, note: def.note });
    }
  };
  build(BRANCH, "branch"); build(ROLE, "role");

  return { units, active, traits };
}

// Deterministic resolution. Interleaved turn order; each unit hits the front-most enemy.
export function simulate(playerUnits: Combatant[], enemyUnits: Combatant[]): CombatResult {
  const P = playerUnits.map((u) => ({ ...u, side: "P" as const, hp: u.maxHp, alive: true }));
  const E = enemyUnits.map((u) => ({ ...u, side: "E" as const, hp: u.maxHp, alive: true }));
  const log: CombatEvent[] = [];
  const front = (a: typeof P) => a.find((u) => u.alive) || null;

  let tick = 0;
  while (tick < TICK_CAP) {
    if (!P.some((u) => u.alive) || !E.some((u) => u.alive)) break;
    const order: any[] = [];
    const m = Math.max(P.length, E.length);
    for (let i = 0; i < m; i++) { if (P[i]) order.push(P[i]); if (E[i]) order.push(E[i]); }
    for (const a of order) {
      if (!a.alive) continue;
      const t = front(a.side === "P" ? E : P);
      if (!t) break;
      t.hp -= a.atk;
      const died = t.hp <= 0;
      if (died) t.alive = false;
      log.push({ atk: a.uid, atkSide: a.side, atkKind: a.kind, tgt: t.uid, died });
      if (!P.some((u) => u.alive) || !E.some((u) => u.alive)) break;
    }
    tick++;
  }
  const pS = P.filter((u) => u.alive).length, eS = E.filter((u) => u.alive).length;
  const winner: "P" | "E" | "D" = pS && !eS ? "P" : eS && !pS ? "E" : pS !== eS ? (pS > eS ? "P" : "E") : "D";
  return { winner, log };
}

export const START_BUDGET = 6;
export const BUDGET_STEP = 3;
export const MAX_LINE = 8;

// Scaling enemy army for a round.
export function genEnemy(round: number): Instance[] {
  const budget = Math.round(START_BUDGET + BUDGET_STEP * (round - 1) * 0.9) + 1;
  const maxCost = round < 2 ? 1 : round < 4 ? 2 : 3;
  const inst: Instance[] = [];
  let spent = 0, pos = 0;
  while (spent < budget && inst.length < MAX_LINE) {
    const pool = UNITS.filter((u) => u.cost <= maxCost && spent + u.cost <= budget);
    if (!pool.length) break;
    const u = pick(pool);
    inst.push({ uid: uid(), id: u.id, pos: pos++ });
    spent += u.cost;
  }
  if (!inst.length) inst.push({ uid: uid(), id: "rifleman", pos: 0 });
  return inst;
}
