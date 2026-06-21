/**
 * Doctrine / tech tree — persistent army-wide research (Pillar 2).
 * lib/doctrine.ts
 *
 * Spend War Research (earned from battles) to unlock nodes along three branches.
 * Effects aggregate into a single DoctrineBonus applied to power, casualties,
 * win chance, income, and unit costs.
 */

export interface DoctrineBonus {
  powerMult: number;        // ×army power in battle
  casualtyMult: number;     // ×casualties (<1 = fewer losses)
  winChanceAdd: number;     // +percentage points to win chance
  recruitDiscount: number;  // 0..0.5 off recruit price
  reinforceDiscount: number;// 0..0.5 off reinforce cost
  incomeMult: number;       // ×gross income
}
export const NEUTRAL: DoctrineBonus = { powerMult: 1, casualtyMult: 1, winChanceAdd: 0, recruitDiscount: 0, reinforceDiscount: 0, incomeMult: 1 };

export type Branch = "firepower" | "fortitude" | "command";
export interface DocNode { id: string; branch: Branch; tier: number; name: string; icon: string; desc: string; cost: number; req: string | null; effect: Partial<DoctrineBonus>; }

export const BRANCHES: { id: Branch; name: string; icon: string; accent: string; blurb: string }[] = [
  { id: "firepower", name: "Firepower", icon: "🔥", accent: "#e5694f", blurb: "Hit harder on the attack." },
  { id: "fortitude", name: "Fortitude", icon: "🛡", accent: "#56b9cf", blurb: "Bleed less, hold longer." },
  { id: "command",   name: "Command",   icon: "⭐", accent: "#f0c860", blurb: "Tempo, supply and strategy." },
];

export const DOCTRINES: DocNode[] = [
  // ---- Firepower ----
  { id: "fp1", branch: "firepower", tier: 1, name: "Creeping Barrage", icon: "💥", desc: "+8% army power", cost: 6,  req: null,  effect: { powerMult: 1.08 } },
  { id: "fp2", branch: "firepower", tier: 2, name: "Shock Troops",     icon: "⚔",  desc: "+10% army power", cost: 10, req: "fp1", effect: { powerMult: 1.10 } },
  { id: "fp3", branch: "firepower", tier: 3, name: "Combined Arms",    icon: "🎯", desc: "+12% power, +3% win chance", cost: 16, req: "fp2", effect: { powerMult: 1.12, winChanceAdd: 3 } },
  { id: "fp4", branch: "firepower", tier: 4, name: "Total War",        icon: "☠",  desc: "+15% army power", cost: 24, req: "fp3", effect: { powerMult: 1.15 } },
  // ---- Fortitude ----
  { id: "ft1", branch: "fortitude", tier: 1, name: "Trench Networks",  icon: "🕳", desc: "−10% casualties", cost: 6,  req: null,  effect: { casualtyMult: 0.90 } },
  { id: "ft2", branch: "fortitude", tier: 2, name: "Field Hospitals",  icon: "⛑", desc: "−12% casualties", cost: 10, req: "ft1", effect: { casualtyMult: 0.88 } },
  { id: "ft3", branch: "fortitude", tier: 3, name: "Reserves Doctrine",icon: "♻",  desc: "−15% reinforce cost", cost: 16, req: "ft2", effect: { reinforceDiscount: 0.15 } },
  { id: "ft4", branch: "fortitude", tier: 4, name: "Defence in Depth", icon: "🧱", desc: "−15% casualties", cost: 24, req: "ft3", effect: { casualtyMult: 0.85 } },
  // ---- Command ----
  { id: "cm1", branch: "command",   tier: 1, name: "Staff College",    icon: "🎓", desc: "+4% win chance", cost: 6,  req: null,  effect: { winChanceAdd: 4 } },
  { id: "cm2", branch: "command",   tier: 2, name: "War Economy",      icon: "🏦", desc: "+12% income", cost: 10, req: "cm1", effect: { incomeMult: 1.12 } },
  { id: "cm3", branch: "command",   tier: 3, name: "Conscription",     icon: "📋", desc: "−15% recruit cost", cost: 16, req: "cm2", effect: { recruitDiscount: 0.15 } },
  { id: "cm4", branch: "command",   tier: 4, name: "Grand Strategy",   icon: "🗺", desc: "+5% win chance, +10% income", cost: 24, req: "cm3", effect: { winChanceAdd: 5, incomeMult: 1.10 } },
];

export const DMAP: Record<string, DocNode> = Object.fromEntries(DOCTRINES.map((d) => [d.id, d]));

// combine all researched nodes into one bonus object
export function aggregateDoctrine(ids: string[] | undefined): DoctrineBonus {
  const b: DoctrineBonus = { ...NEUTRAL };
  for (const id of ids || []) {
    const e = DMAP[id]?.effect; if (!e) continue;
    if (e.powerMult) b.powerMult *= e.powerMult;
    if (e.casualtyMult) b.casualtyMult *= e.casualtyMult;
    if (e.winChanceAdd) b.winChanceAdd += e.winChanceAdd;
    if (e.recruitDiscount) b.recruitDiscount = Math.min(0.5, b.recruitDiscount + e.recruitDiscount);
    if (e.reinforceDiscount) b.reinforceDiscount = Math.min(0.5, b.reinforceDiscount + e.reinforceDiscount);
    if (e.incomeMult) b.incomeMult *= e.incomeMult;
  }
  return b;
}

// research awarded per battle
export const RESEARCH_WIN = 3;
export const RESEARCH_LOSS = 1;

// can this node be researched right now?
export function canResearch(id: string, owned: string[], research: number): boolean {
  const n = DMAP[id]; if (!n) return false;
  if (owned.includes(id)) return false;
  if (n.req && !owned.includes(n.req)) return false;
  return research >= n.cost;
}
