// lib/economy.ts — Homeland economy: buildable estate, food/starvation, Rand money.
//
// MONEY UNIT: 1 money point = R1,000 ("a grand"). This keeps all existing game
// balance intact while displaying realistic Rand figures (treasuries in the
// millions, tanks costing ~R500k, etc.). Use randMoney() everywhere money shows.

export function randMoney(v: number): string {
  const r = Math.round(v) * 1000;
  const neg = r < 0 ? "-" : "";
  const a = Math.abs(r);
  if (a >= 1_000_000) return `${neg}R ${(a / 1_000_000).toFixed(2)}M`;
  return `${neg}R ${a.toLocaleString("en-ZA")}`;
}
// short form for tight UI (always M/k)
export function randShort(v: number): string {
  const r = Math.round(v) * 1000, a = Math.abs(r), neg = r < 0 ? "-" : "";
  if (a >= 1_000_000) return `${neg}R${(a / 1_000_000).toFixed(1)}M`;
  if (a >= 1_000) return `${neg}R${Math.round(a / 1_000)}k`;
  return `${neg}R${a}`;
}

/* ---------------- buildings ---------------- */
export type BKind = "industry" | "mine" | "factory" | "farm" | "infra" | "barracks";
export interface BuildingDef {
  id: string; name: string; icon: string; kind: BKind; desc: string;
  baseCost: number;   // money to build level 1
  costMult: number;   // each level costs baseCost * costMult^level
  baseOut: number;    // output per level (meaning depends on kind)
  max: number;        // max level
  outLabel: string;   // for UI
}

export const BUILDINGS: BuildingDef[] = [
  { id: "industry", name: "Industrial Works",   icon: "🏭", kind: "industry", desc: "Steel, textiles and manufactured goods. Steady monthly revenue.",      baseCost: 600,  costMult: 1.70, baseOut: 90,  max: 6, outLabel: "income/mo" },
  { id: "mine",     name: "Gold & Mineral Mine", icon: "⛏️", kind: "mine",     desc: "Digs wealth straight from the earth — your richest single earner.",     baseCost: 1100, costMult: 1.80, baseOut: 160, max: 6, outLabel: "income/mo" },
  { id: "factory",  name: "War Factory",         icon: "⚙️", kind: "factory",  desc: "Munitions and armour. Adds revenue and cuts recruitment costs (−5%/lvl).", baseCost: 900,  costMult: 1.85, baseOut: 70,  max: 5, outLabel: "income/mo" },
  { id: "farm",     name: "State Farmland",      icon: "🌾", kind: "farm",     desc: "Grain and cattle. Feeds your army and citizens — without it, they starve.", baseCost: 400, costMult: 1.55, baseOut: 12,  max: 7, outLabel: "food/mo" },
  { id: "rail",     name: "Railway Network",     icon: "🚆", kind: "infra",    desc: "Logistics backbone. Boosts ALL income by +7% per level.",                baseCost: 1300, costMult: 2.00, baseOut: 7,   max: 4, outLabel: "% income" },
  { id: "barracks", name: "Conscription Office", icon: "🎖️", kind: "barracks", desc: "Trains reservists at home — produces supplies every month.",             baseCost: 500,  costMult: 1.60, baseOut: 30,  max: 5, outLabel: "supplies/mo" },
];
export const BMAP: Record<string, BuildingDef> = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));

// cost to go from `level` -> level+1 (level = current level held)
export function buildingCost(def: BuildingDef, level: number): number {
  return Math.round(def.baseCost * Math.pow(def.costMult, level));
}
// output at a given level (linear per level)
export function buildingOutput(def: BuildingDef, level: number): number {
  return def.baseOut * level;
}

/* ---------------- aggregated homeland economy ---------------- */
export interface EconReport {
  income: number;          // money-units / month from buildings (rail % applied)
  food: number;            // food produced / month
  supplies: number;        // supplies / month
  railPct: number;         // logistics bonus (0..)
  recruitDiscount: number; // 0..0.25 from the war factory
}

// number of buildable plots on the homeland
export const PLOT_COUNT = 20;
export interface Plot { type: string | null; level: number; }
export interface Placed { type: string; level: number; }

// aggregate from a list of placed buildings (multiple of the same type allowed)
export function homelandEconList(placed: Placed[]): EconReport {
  let base = 0, food = 0, supplies = 0, railPct = 0, factoryLvl = 0;
  for (const p of placed) {
    const def = BMAP[p.type]; if (!def || p.level <= 0) continue;
    const out = buildingOutput(def, p.level);
    if (def.kind === "industry" || def.kind === "mine") base += out;
    else if (def.kind === "factory") { base += out; factoryLvl = Math.max(factoryLvl, p.level); }
    else if (def.kind === "farm") food += out;
    else if (def.kind === "infra") railPct += out / 100;
    else if (def.kind === "barracks") supplies += out;
  }
  return { income: Math.round(base * (1 + railPct)), food, supplies, railPct, recruitDiscount: Math.min(0.25, factoryLvl * 0.05) };
}

// legacy: aggregate from a {id: level} map (kept for save migration)
export function homelandEcon(buildings: Record<string, number> | undefined): EconReport {
  const placed: Placed[] = [];
  for (const b of BUILDINGS) { const lvl = buildings?.[b.id] || 0; if (lvl > 0) placed.push({ type: b.id, level: lvl }); }
  return homelandEconList(placed);
}

// food the nation must produce each month: civilians (flat) + the army in the field
export function foodNeed(totalTroops: number): number {
  return Math.round(6 + totalTroops / 600);
}

// population shown per nation (millions, c.1916) — flavour + scale of the home front
export const NATION_POP: Record<string, number> = {
  southafrica: 6, britain: 46, france: 40, germany: 65, usa: 103, russia: 175,
  italy: 36, japan: 56, belgium: 8, serbia: 4, romania: 8, austria: 51, ottoman: 21, bulgaria: 5,
};
export function nationPop(id: string | null): number { return (id && NATION_POP[id]) || 12; }
