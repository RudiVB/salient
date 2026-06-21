// lib/trade.ts — upgradeable trade routes that generate passive £/hr.

export interface Route {
  id: string;
  name: string;
  desc: string;
  icon: string;
  baseCost: number;     // cost of the first level
  baseIncome: number;   // £/hr added per level
  reqTerritory?: number;// regions you must hold before it unlocks
}

export const TRADE_MAX = 5;

export const ROUTES: Route[] = [
  { id: "bonds",    name: "War Bonds",         icon: "🎗", desc: "Sell the war to the home front. Reliable, patriotic money.",       baseCost: 400,  baseIncome: 8 },
  { id: "munitions",name: "Munitions Contracts",icon: "🏭", desc: "Shell and rifle orders for the state arsenals.",                   baseCost: 700,  baseIncome: 12 },
  { id: "steel",    name: "Steel & Coal",      icon: "⛏", desc: "Heavy industry — the raw sinew of a modern army.",                  baseCost: 1100, baseIncome: 18 },
  { id: "convoy",   name: "Atlantic Convoys",  icon: "🚢", desc: "Overseas trade lanes. Lucrative once you hold the coasts.",        baseCost: 1500, baseIncome: 26, reqTerritory: 2 },
  { id: "colonial", name: "Colonial Goods",    icon: "🌍", desc: "Resources drawn from the territories you've taken.",               baseCost: 2000, baseIncome: 34, reqTerritory: 4 },
];

const R: Record<string, Route> = Object.fromEntries(ROUTES.map((r) => [r.id, r]));

export function routeIncome(id: string, level: number): number {
  const r = R[id]; return r ? r.baseIncome * Math.max(0, level) : 0;
}
export function routeCost(id: string, level: number): number {
  const r = R[id]; if (!r || level >= TRADE_MAX) return Infinity;
  return Math.round(r.baseCost * Math.pow(1.8, level));
}
export function tradeIncomeTotal(trade: Record<string, number> | undefined): number {
  return ROUTES.reduce((s, r) => s + routeIncome(r.id, trade?.[r.id] || 0), 0);
}
