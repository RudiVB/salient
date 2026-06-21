// lib/catalog.ts — single source of truth for units.
// Models each unit as a REGIMENT: it has a troop count (e.g. 8,000 men).
// Battle casualties reduce troops; at 0 the unit is lost. Medics/supplies refill.

export type Kind = "soldier" | "gas" | "tank" | "artillery" | "plane" | "car" | "medic";
export type Rarity = "common" | "rare" | "elite" | "legendary";

export interface SynDef {
  color: string;
  scope: "self" | "all";
  tiers: { n: number; atkPct?: number; hp?: number }[];
  note: string;
}

export interface UnitDef {
  id: string;
  name: string;                 // display name
  branch: "Infantry" | "Armor" | "Artillery";
  role: "Line" | "Assault" | "Support";
  rarity: Rarity;
  kind: Kind;                   // visual archetype (placeholder art)
  accent: string;              // per-unit tint so placeholders differ
  cost: number;                 // deployment points (battle)
  atk: number;                  // per-soldier attack (battle)
  hp: number;                   // per-soldier resilience (battle)
  maxTroops: number;            // regiment size
  blurb: string;
  nation?: string;              // if set, only this nation can field/recruit it (signature unit)
  emoji?: string;               // icon for nation-special units
}

export const RARITY: Record<Rarity, { color: string; label: string }> = {
  common:    { color: "#9c8e6e", label: "Common" },
  rare:      { color: "#4f9bff", label: "Rare" },
  elite:     { color: "#b07cff", label: "Elite" },
  legendary: { color: "#e0b24a", label: "Legendary" },
};

export const BRANCH: Record<string, SynDef> = {
  Infantry:  { color: "#c8a86a", scope: "self", tiers: [{ n: 2, atkPct: 0.2 }, { n: 4, atkPct: 0.45 }], note: "Massed Ranks (+atk)" },
  Armor:     { color: "#7fa8b0", scope: "self", tiers: [{ n: 2, hp: 250 },       { n: 4, hp: 600 }],       note: "Hardened Steel (+hp)" },
  Artillery: { color: "#d6473f", scope: "all",  tiers: [{ n: 2, atkPct: 0.15 }, { n: 4, atkPct: 0.35 }], note: "Barrage (+atk to whole army)" },
};
export const ROLE: Record<string, SynDef> = {
  Line:    { color: "#6f93d6", scope: "self", tiers: [{ n: 2, hp: 300 },       { n: 3, hp: 700 }],       note: "Dig In (+hp)" },
  Assault: { color: "#d6843f", scope: "self", tiers: [{ n: 2, atkPct: 0.25 }, { n: 4, atkPct: 0.55 }], note: "Over the Top (+atk)" },
  Support: { color: "#9bc24a", scope: "self", tiers: [{ n: 2, atkPct: 0.30 }, { n: 3, atkPct: 0.65 }], note: "Suppressing Fire (+atk)" },
};

export const UNITS: UnitDef[] = [
  { id: "rifleman", name: "1st Line Infantry",    branch: "Infantry",  role: "Support", rarity: "common", kind: "soldier",   accent: "#9aa05a", cost: 1, atk: 58,  hp: 480,  maxTroops: 8000,  blurb: "The backbone of the line. Cheap, plentiful, expendable." },
  { id: "grenadier",name: "Trench Raiders",       branch: "Infantry",  role: "Assault", rarity: "common", kind: "soldier",   accent: "#b08043", cost: 1, atk: 60,  hp: 550,  maxTroops: 5000,  blurb: "Night raiders with club and grenade. First over the top." },
  { id: "car",      name: "Armoured Car",         branch: "Armor",     role: "Line",    rarity: "rare",   kind: "car",       accent: "#6f8e9a", cost: 1, atk: 45,  hp: 650,  maxTroops: 1200,  blurb: "Fast steel on the flank. Few in number, hard to stop." },
  { id: "recon",    name: "Recon Squadron",       branch: "Armor",     role: "Assault", rarity: "rare",   kind: "plane",     accent: "#7fa0b8", cost: 1, atk: 50,  hp: 600,  maxTroops: 800,   blurb: "Biplanes that strafe and scout ahead of the advance." },
  { id: "mortar",   name: "Stokes Mortar Crew",   branch: "Artillery", role: "Support", rarity: "common", kind: "artillery", accent: "#b06a4a", cost: 1, atk: 55,  hp: 450,  maxTroops: 3000,  blurb: "Lobbed shells over the parapet. Cheap indirect fire." },
  { id: "guard",    name: "Garrison Holdfast",    branch: "Infantry",  role: "Line",    rarity: "rare",   kind: "soldier",   accent: "#7a8a55", cost: 2, atk: 65,  hp: 850,  maxTroops: 10000, blurb: "Dug-in defenders who refuse to yield ground." },
  { id: "tank",     name: "Mark IV 'Mother'",     branch: "Armor",     role: "Line",    rarity: "elite",  kind: "tank",      accent: "#6f7a6a", cost: 2, atk: 60,  hp: 900,  maxTroops: 600,   blurb: "The lozenge tank. Crushes wire, breaks the line." },
  { id: "gas",      name: "Chlorine Pioneers",    branch: "Artillery", role: "Assault", rarity: "rare",   kind: "gas",       accent: "#9bb04a", cost: 2, atk: 80,  hp: 650,  maxTroops: 4000,  blurb: "Release the cloud. Grim work in the masked dark." },
  { id: "fieldgun", name: "18-Pounder Battery",   branch: "Artillery", role: "Support", rarity: "rare",   kind: "artillery", accent: "#c08a3c", cost: 2, atk: 95,  hp: 550,  maxTroops: 2500,  blurb: "The workhorse field gun of the war." },
  { id: "medic",    name: "Field Ambulance Corps",branch: "Infantry",  role: "Support", rarity: "rare",   kind: "medic",     accent: "#d6473f", cost: 2, atk: 10,  hp: 500,  maxTroops: 2000,  blurb: "Stretcher-bearers. Keeps your numbers from bleeding out." },
  { id: "storm",    name: "Sturmtruppen",         branch: "Infantry",  role: "Assault", rarity: "elite",  kind: "gas",       accent: "#8a6f3a", cost: 3, atk: 130, hp: 800,  maxTroops: 4000,  blurb: "Elite infiltration squads with flamethrower and grenade." },
  { id: "sniper",   name: "Lovat Scouts",         branch: "Infantry",  role: "Support", rarity: "elite",  kind: "soldier",   accent: "#6a7048", cost: 3, atk: 150, hp: 600,  maxTroops: 1500,  blurb: "Marksmen who pick off officers from the wire." },
  { id: "landship", name: "Mark V Landship",      branch: "Armor",     role: "Line",    rarity: "legendary", kind: "tank",   accent: "#7a8470", cost: 3, atk: 90,  hp: 1200, maxTroops: 400,   blurb: "A moving fortress. The enemy line breaks before it." },
  { id: "howitzer", name: "BL 9.2-inch Siege",    branch: "Artillery", role: "Support", rarity: "legendary", kind: "artillery", accent: "#d6473f", cost: 3, atk: 150, hp: 650, maxTroops: 1000, blurb: "Siege artillery. Erases a square of the map." },

  // ---- NATION SIGNATURE UNITS (only that nation can field them) ----
  { id: "sp_britain",     name: "Tank Pioneers",            branch: "Armor",     role: "Line",    rarity: "legendary", kind: "tank",      accent: "#3d6b8a", cost: 3, atk: 95,  hp: 1350, maxTroops: 600,   nation: "britain",     emoji: "🛡", blurb: "Armour is tougher and cheaper — the first landships are yours." },
  { id: "sp_southafrica", name: "Veld Commando",            branch: "Armor",     role: "Assault", rarity: "legendary", kind: "car",       accent: "#c0913c", cost: 2, atk: 105, hp: 720,  maxTroops: 1600,  nation: "southafrica", emoji: "🐎", blurb: "Fast mounted columns outflank and outrun the enemy across open country." },
  { id: "sp_france",      name: "Canon de 75 Battery",      branch: "Artillery", role: "Support", rarity: "legendary", kind: "artillery", accent: "#3a5fa0", cost: 3, atk: 140, hp: 600,  maxTroops: 2600,  nation: "france",      emoji: "💥", blurb: "The quick-firing 75 — a wall of shellfire ahead of every advance." },
  { id: "sp_russia",      name: "Imperial Levies",          branch: "Infantry",  role: "Line",    rarity: "legendary", kind: "soldier",   accent: "#3f7a4a", cost: 2, atk: 55,  hp: 520,  maxTroops: 14000, nation: "russia",      emoji: "🐻", blurb: "Endless numbers. Where one falls, two more step up." },
  { id: "sp_italy",       name: "Arditi Shock Troops",      branch: "Infantry",  role: "Assault", rarity: "legendary", kind: "gas",       accent: "#3f8f6a", cost: 3, atk: 140, hp: 820,  maxTroops: 3500,  nation: "italy",       emoji: "🗡️", blurb: "Dagger-men who storm trenches before the barrage lifts." },
  { id: "sp_usa",         name: "Doughboys",                branch: "Infantry",  role: "Line",    rarity: "legendary", kind: "soldier",   accent: "#2f5fae", cost: 2, atk: 90,  hp: 820,  maxTroops: 9000,  nation: "usa",         emoji: "🦅", blurb: "Fresh, well-supplied, and seemingly without end." },
  { id: "sp_japan",       name: "Imperial Marines",         branch: "Armor",     role: "Assault", rarity: "legendary", kind: "tank",      accent: "#a83a3a", cost: 3, atk: 110, hp: 920,  maxTroops: 3000,  nation: "japan",       emoji: "⚓", blurb: "Naval landing troops with armoured support." },
  { id: "sp_belgium",     name: "Yser Defenders",           branch: "Infantry",  role: "Line",    rarity: "legendary", kind: "soldier",   accent: "#c79a2f", cost: 2, atk: 60,  hp: 1150, maxTroops: 9000,  nation: "belgium",     emoji: "🛡️", blurb: "They opened the sluices and held the last corner of the country." },
  { id: "sp_serbia",      name: "Chetnik Irregulars",       branch: "Infantry",  role: "Assault", rarity: "legendary", kind: "soldier",   accent: "#9a3a3a", cost: 2, atk: 120, hp: 650,  maxTroops: 4000,  nation: "serbia",      emoji: "🗡️", blurb: "Mountain fighters who melt away and strike again." },
  { id: "sp_romania",     name: "Vânători Mountain Troops", branch: "Infantry",  role: "Line",    rarity: "legendary", kind: "soldier",   accent: "#3f7a5a", cost: 2, atk: 80,  hp: 760,  maxTroops: 6000,  nation: "romania",     emoji: "⛰️", blurb: "Hunters of the high passes, sure-footed and patient." },
  { id: "sp_germany",     name: "Stoßtruppen",              branch: "Infantry",  role: "Assault", rarity: "legendary", kind: "gas",       accent: "#5a6068", cost: 3, atk: 150, hp: 820,  maxTroops: 4000,  nation: "germany",     emoji: "⚡", blurb: "Infiltration doctrine perfected — bypass strongpoints, collapse the rear." },
  { id: "sp_austria",     name: "Kaiserjäger",              branch: "Infantry",  role: "Line",    rarity: "legendary", kind: "soldier",   accent: "#6a6f78", cost: 2, atk: 75,  hp: 1050, maxTroops: 7000,  nation: "austria",     emoji: "🏔️", blurb: "Imperial mountain rifles holding the alpine front." },
  { id: "sp_ottoman",     name: "Gallipoli Defenders",      branch: "Infantry",  role: "Line",    rarity: "legendary", kind: "soldier",   accent: "#b03a2f", cost: 2, atk: 70,  hp: 1100, maxTroops: 8000,  nation: "ottoman",     emoji: "🌙", blurb: "Dug into the cliffs, they threw every landing back into the sea." },
  { id: "sp_bulgaria",    name: "Macedonian Brigades",      branch: "Infantry",  role: "Line",    rarity: "legendary", kind: "soldier",   accent: "#3f6a4a", cost: 2, atk: 80,  hp: 980,  maxTroops: 6000,  nation: "bulgaria",    emoji: "🛡️", blurb: "Hardened veterans of the Balkan wars." },
];

// nation id -> its signature unit id
export const NATION_SPECIAL: Record<string, string> = {
  britain: "sp_britain", southafrica: "sp_southafrica", france: "sp_france", russia: "sp_russia",
  italy: "sp_italy", usa: "sp_usa", japan: "sp_japan", belgium: "sp_belgium", serbia: "sp_serbia",
  romania: "sp_romania", germany: "sp_germany", austria: "sp_austria", ottoman: "sp_ottoman", bulgaria: "sp_bulgaria",
};

export const CATALOG: Record<string, UnitDef> = Object.fromEntries(UNITS.map((u) => [u.id, u]));
export const COST_COLOR: Record<number, string> = { 1: "#9c8e6e", 2: "#c69a3c", 3: "#d6473f" };

export const fmt = (n: number) => Math.round(n).toLocaleString("en-US");
