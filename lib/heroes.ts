/**
 * Veteran Heroes — named commanders that persist and level across battles (Pillar 2).
 * lib/heroes.ts
 *
 * A regiment that survives enough winning battles is promoted: a named commander
 * takes charge, levels up with each battle, earns traits, and buffs that regiment.
 * If the regiment is wiped out, the commander falls (KIA) and is lost.
 */

export interface Hero {
  name: string;
  level: number;
  xp: number;          // toward next level
  traits: string[];    // trait ids
  battles: number;
  seed: number;        // drives emblem colours
}

export interface HeroTrait { id: string; name: string; icon: string; desc: string; powerMult?: number; casualtyMult?: number; winChanceAdd?: number; }
export const TRAITS: HeroTrait[] = [
  { id: "shock",     name: "Shock Trooper", icon: "⚡", desc: "+18% regiment power",     powerMult: 1.18 },
  { id: "marksman",  name: "Marksman",      icon: "🎯", desc: "+12% regiment power",     powerMult: 1.12 },
  { id: "relentless",name: "Relentless",    icon: "🔥", desc: "+15% regiment power",     powerMult: 1.15 },
  { id: "iron",      name: "Iron Will",     icon: "🛡", desc: "−16% casualties",         casualtyMult: 0.84 },
  { id: "trench",    name: "Trench Fighter",icon: "🕳", desc: "−12% casualties",         casualtyMult: 0.88 },
  { id: "tactician", name: "Tactician",     icon: "♟", desc: "+3% win chance",           winChanceAdd: 3 },
  { id: "inspiring", name: "Inspiring",     icon: "📣", desc: "+8% power, −6% casualties", powerMult: 1.08, casualtyMult: 0.94 },
  { id: "veteran",   name: "Old Guard",     icon: "🎖", desc: "+10% power",              powerMult: 1.10 },
];
export const TMAP: Record<string, HeroTrait> = Object.fromEntries(TRAITS.map((t) => [t.id, t]));

const FIRST = ["Hendrik", "Pieter", "Johan", "Friedrich", "Wilhelm", "Henri", "Émile", "Albert", "James", "Edmund", "Nikolai", "Dmitri", "Lev", "Marco", "Cesare", "Stefan", "Anton", "Karel", "Lucas", "Gerhard", "Otto", "Charles", "Frank", "Viktor", "Ivan", "Theodore", "Maximilian", "Rudolf"];
const LAST = ["van der Merwe", "Botha", "Krause", "Steyn", "Müller", "Schmidt", "Laurent", "Dubois", "Carter", "Whitfield", "Volkov", "Petrov", "Romano", "Bianchi", "Novak", "Kovač", "Janssen", "de Vries", "Hartmann", "Brandt", "Ashford", "Sterling", "Falk", "Adler", "Ferreira", "du Toit", "Visser", "Marais"];
const RANKS = ["Lieutenant", "Captain", "Major", "Colonel", "Brigadier", "General", "Field Marshal"];
export const rankForLevel = (lvl: number) => RANKS[Math.min(RANKS.length - 1, Math.floor((lvl - 1) / 2))];

export const xpToNext = (level: number) => 100 * level;

// deterministic hero from a numeric seed (so the same regiment always gets the same commander)
export function genHero(seed: number): Hero {
  const s = seed >>> 0;
  const first = FIRST[s % FIRST.length];
  const last = LAST[(s >>> 5) % LAST.length];
  const trait = TRAITS[(s >>> 10) % TRAITS.length].id;
  return { name: `${first} ${last}`, level: 1, xp: 0, traits: [trait], battles: 0, seed: s };
}

// add XP for a fought battle → may level up and gain traits (pure)
export function addHeroXP(hero: Hero, amount: number): Hero {
  let { level, xp } = hero; let traits = [...hero.traits];
  xp += amount;
  while (xp >= xpToNext(level)) { xp -= xpToNext(level); level++;
    // gain a new trait at levels 3, 5, 7 … up to 3 traits total
    if (level % 2 === 1 && traits.length < 3) {
      const pool = TRAITS.filter((t) => !traits.includes(t.id));
      if (pool.length) traits.push(pool[(hero.seed + level) % pool.length].id);
    }
  }
  return { ...hero, level, xp, traits, battles: hero.battles + 1 };
}

// ---- per-regiment hero bonuses ----
export function heroPowerMult(h: Hero | undefined): number { if (!h) return 1; let m = 1 + h.level * 0.02; for (const t of h.traits) m *= TMAP[t]?.powerMult || 1; return m; }
export function heroCasualtyMult(h: Hero | undefined): number { if (!h) return 1; let m = 1; for (const t of h.traits) m *= TMAP[t]?.casualtyMult || 1; return m; }
export function heroWinChanceAdd(h: Hero | undefined): number { if (!h) return 0; let a = 0; for (const t of h.traits) a += TMAP[t]?.winChanceAdd || 0; return a; }

// ---- army-level aggregate (for power & win chance in battle) ----
export interface HeroArmyBonus { powerMult: number; winChanceAdd: number; count: number; }
export function heroArmyBonus(units: { hero?: Hero }[]): HeroArmyBonus {
  let powerDelta = 0, winAdd = 0, count = 0;
  for (const u of units) { if (!u.hero) continue; count++; powerDelta += heroPowerMult(u.hero) - 1; winAdd += heroWinChanceAdd(u.hero); }
  return { powerMult: 1 + Math.min(0.6, powerDelta), winChanceAdd: Math.min(10, winAdd), count };
}

// when does a surviving regiment earn a commander? (after this many veterancy stars)
export const HERO_VET_THRESHOLD = 2;
export const XP_WIN = 60;
export const XP_LOSS = 25;
