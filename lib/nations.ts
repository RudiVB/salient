// lib/nations.ts — playable WW1 powers. Perks light now; deepen when battles wire in.

export interface NationStats { inf: number; arm: number; art: number; man: number; sup: number; } // 1..5
export type PerkKind = "assault" | "armor" | "artillery" | "numbers" | "defense" | "supply" | "mobility";
export type Alliance = "Allied" | "Central";

export interface Nation {
  id: string;
  name: string;
  alliance: Alliance;
  colors: string[];
  accent: string;            // strong national colour for UI theming
  emblem: string;
  leader: string;            // wartime leader, ~1916
  capital: string;
  difficulty: "Medium" | "Hard" | "Expert";
  perkTitle: string;
  perk: string;
  perkKind: PerkKind;
  stats: NationStats;
  signature: string;
  fronts: string[];
  blurb: string;
  note: string;
  startUnit?: string;        // catalog id granted on selection
  startSupplies?: number;
}

export const NATIONS: Nation[] = [
  // ---------------- ALLIED POWERS ----------------
  {
    id: "britain", name: "British Empire", alliance: "Allied", colors: ["#012169", "#fff", "#c8102e"], accent: "#1d4fa0", emblem: "B",
    leader: "King George V", capital: "London", difficulty: "Medium",
    perkTitle: "Tank Pioneers", perkKind: "armor", perk: "Armour is tougher and cheaper — the first landships are yours.",
    stats: { inf: 3, arm: 5, art: 4, man: 3, sup: 4 }, signature: "Mark I Landship", fronts: ["Western"],
    blurb: "Steel and sea power. The lozenge tank rolls first.",
    note: "Fielded the first tanks at the Somme, 1916 — slow, crude, and terrifying.", startUnit: "landship",
  },
  {
    id: "france", name: "French Republic", alliance: "Allied", colors: ["#0055a4", "#fff", "#ef4135"], accent: "#0055a4", emblem: "F",
    leader: "Pres. Raymond Poincaré", capital: "Paris", difficulty: "Medium",
    perkTitle: "Feu à Volonté", perkKind: "artillery", perk: "Artillery barrages strike harder — the 75 never rests.",
    stats: { inf: 4, arm: 3, art: 5, man: 3, sup: 3 }, signature: "Canon de 75 Battery", fronts: ["Western"],
    blurb: "Defenders of Verdun. The guns speak for France.",
    note: "The 75mm field gun — fast-firing, deadly, the backbone of French firepower.", startUnit: "fieldgun", startSupplies: 40,
  },
  {
    id: "russia", name: "Russian Empire", alliance: "Allied", colors: ["#fff", "#0039a6", "#d52b1e"], accent: "#1e57c4", emblem: "R",
    leader: "Tsar Nicholas II", capital: "Petrograd", difficulty: "Hard",
    perkTitle: "The Steamroller", perkKind: "numbers", perk: "Vast manpower — bigger regiments, cheaper reinforcement.",
    stats: { inf: 4, arm: 2, art: 3, man: 5, sup: 2 }, signature: "Imperial Levies", fronts: ["Eastern"],
    blurb: "Endless ranks from the east. Numbers are a weapon.",
    note: "Limitless manpower, chronic shortages — quantity thrown against quality.", startSupplies: 120,
  },
  {
    id: "italy", name: "Kingdom of Italy", alliance: "Allied", colors: ["#009246", "#fff", "#ce2b37"], accent: "#009246", emblem: "I",
    leader: "King Victor Emmanuel III", capital: "Rome", difficulty: "Hard",
    perkTitle: "Alpini Doctrine", perkKind: "defense", perk: "Mountain regiments hold rugged ground that breaks other armies.",
    stats: { inf: 4, arm: 2, art: 4, man: 3, sup: 3 }, signature: "Arditi Shock Troops", fronts: ["Italian", "Alpine"],
    blurb: "War in the clouds along the Isonzo.",
    note: "Eleven battles on the Isonzo against Austria, fought across ice and stone.", startUnit: "recon", startSupplies: 30,
  },
  {
    id: "usa", name: "United States", alliance: "Allied", colors: ["#b22234", "#fff", "#3c3b6e"], accent: "#3c3b6e", emblem: "U",
    leader: "Pres. Woodrow Wilson", capital: "Washington", difficulty: "Medium",
    perkTitle: "Industrial Might", perkKind: "supply", perk: "Boundless industry — far more supplies and fresh reserves.",
    stats: { inf: 3, arm: 3, art: 4, man: 4, sup: 5 }, signature: "Doughboys", fronts: ["Western"],
    blurb: "Fresh, unbloodied, and limitless.",
    note: "Entered late in force — the factory of the war turned the balance.", startSupplies: 150,
  },
  {
    id: "japan", name: "Empire of Japan", alliance: "Allied", colors: ["#fff", "#bc002d", "#fff"], accent: "#bc002d", emblem: "J",
    leader: "Emperor Taishō", capital: "Tokyo", difficulty: "Medium",
    perkTitle: "Rising Sun", perkKind: "armor", perk: "Modern, well-equipped forces — strong armour and matériel.",
    stats: { inf: 3, arm: 4, art: 3, man: 3, sup: 4 }, signature: "Imperial Marines", fronts: ["Pacific", "Tsingtao"],
    blurb: "A modern army seizing the Pacific.",
    note: "Took Germany's Pacific colonies and the fortress of Tsingtao.", startUnit: "tank",
  },
  {
    id: "belgium", name: "Belgium", alliance: "Allied", colors: ["#000", "#fae042", "#ed2939"], accent: "#fae042", emblem: "B",
    leader: "King Albert I", capital: "Brussels", difficulty: "Expert",
    perkTitle: "Last Redoubt", perkKind: "defense", perk: "Defenders dig in behind the floods and refuse to break.",
    stats: { inf: 3, arm: 2, art: 2, man: 2, sup: 2 }, signature: "Yser Defenders", fronts: ["Western"],
    blurb: "A sliver of country that would not fall.",
    note: "Held the last corner of Belgium by flooding the Yser plain.", startUnit: "guard", startSupplies: 20,
  },
  {
    id: "serbia", name: "Kingdom of Serbia", alliance: "Allied", colors: ["#c6363c", "#0c4076", "#fff"], accent: "#c6363c", emblem: "S",
    leader: "King Peter I", capital: "Belgrade", difficulty: "Hard",
    perkTitle: "Komitadji", perkKind: "assault", perk: "Hardened fighters strike fiercely in broken terrain.",
    stats: { inf: 4, arm: 1, art: 2, man: 3, sup: 2 }, signature: "Chetnik Irregulars", fronts: ["Balkan"],
    blurb: "Where the war began — and would not yield.",
    note: "Bled three invasions before being overrun, then fought on from exile.", startUnit: "grenadier",
  },
  {
    id: "romania", name: "Kingdom of Romania", alliance: "Allied", colors: ["#002b7f", "#fcd116", "#ce1126"], accent: "#fcd116", emblem: "R",
    leader: "King Ferdinand I", capital: "Bucharest", difficulty: "Expert",
    perkTitle: "Carpathian Levy", perkKind: "numbers", perk: "A large army — green, but willing to bleed for the mountains.",
    stats: { inf: 3, arm: 1, art: 2, man: 4, sup: 2 }, signature: "Vânători Mountain Troops", fronts: ["Eastern", "Balkan"],
    blurb: "Grain and oil, coveted by both sides.",
    note: "Joined the Allies in 1916 and was nearly overrun within months.", startSupplies: 100,
  },
  {
    id: "southafrica", name: "Union of South Africa", alliance: "Allied", colors: ["#c8102e", "#012169", "#f0c860"], accent: "#007a4d", emblem: "ZA",
    leader: "Gen. Jan Smuts", capital: "Pretoria", difficulty: "Hard",
    perkTitle: "Veld Commando", perkKind: "mobility", perk: "Fast mounted columns outflank and outrun the enemy across open country.",
    stats: { inf: 3, arm: 2, art: 2, man: 3, sup: 3 }, signature: "Mounted Commandos", fronts: ["German South-West Africa", "East Africa"],
    blurb: "Mounted columns sweeping across the African veld.",
    note: "Smuts' commandos overran German South-West Africa and chased von Lettow across East Africa.", startUnit: "recon", startSupplies: 30,
  },

  // ---------------- CENTRAL POWERS ----------------
  {
    id: "germany", name: "German Empire", alliance: "Central", colors: ["#141414", "#e9e9e9", "#c8102e"], accent: "#c8102e", emblem: "G",
    leader: "Kaiser Wilhelm II", capital: "Berlin", difficulty: "Hard",
    perkTitle: "Sturm Doctrine", perkKind: "assault", perk: "Assault regiments hit harder — stormtroopers lead the breakthrough.",
    stats: { inf: 5, arm: 3, art: 4, man: 3, sup: 3 }, signature: "Stoßtruppen — Stormtroopers", fronts: ["Western", "Eastern"],
    blurb: "Caught between two fronts, master of the lightning assault.",
    note: "Pioneers of infiltration tactics — small, fast squads punching holes in the line.", startUnit: "storm",
  },
  {
    id: "austria", name: "Austria-Hungary", alliance: "Central", colors: ["#c8102e", "#fff", "#c8102e"], accent: "#c8102e", emblem: "A",
    leader: "Emperor Franz Joseph I", capital: "Vienna", difficulty: "Hard",
    perkTitle: "Festung", perkKind: "defense", perk: "Dug-in line regiments hold far longer.",
    stats: { inf: 3, arm: 3, art: 3, man: 3, sup: 3 }, signature: "Kaiserjäger", fronts: ["Eastern", "Italian"],
    blurb: "A patchwork empire that fights on every border.",
    note: "A dozen nationalities under one crown, holding lines against Italy and Russia.", startUnit: "guard",
  },
  {
    id: "ottoman", name: "Ottoman Empire", alliance: "Central", colors: ["#e30a17", "#e30a17", "#fff"], accent: "#e30a17", emblem: "O",
    leader: "Sultan Mehmed V", capital: "Constantinople", difficulty: "Expert",
    perkTitle: "Entrenched", perkKind: "supply", perk: "Supplies stretch further across vast, harsh fronts.",
    stats: { inf: 3, arm: 2, art: 2, man: 3, sup: 2 }, signature: "Gallipoli Defenders", fronts: ["Gallipoli", "Caucasus", "Sinai"],
    blurb: "Holding the gates between continents.",
    note: "Outgunned but dug deep — repelled the Allied landings at Gallipoli.", startSupplies: 90,
  },
  {
    id: "bulgaria", name: "Kingdom of Bulgaria", alliance: "Central", colors: ["#fff", "#00966e", "#d62612"], accent: "#00966e", emblem: "B",
    leader: "Tsar Ferdinand I", capital: "Sofia", difficulty: "Hard",
    perkTitle: "Balkan Bastion", perkKind: "defense", perk: "Stubborn defensive infantry that grinds attackers down.",
    stats: { inf: 4, arm: 2, art: 3, man: 3, sup: 3 }, signature: "Macedonian Brigades", fronts: ["Macedonian", "Balkan"],
    blurb: "The strongest army of the Balkans.",
    note: "Crushed Serbia and held the Macedonian front for years.", startUnit: "guard", startSupplies: 30,
  },
];

export const NATION = Object.fromEntries(NATIONS.map((n) => [n.id, n]));
export const ALLIANCES: Alliance[] = ["Allied", "Central"];
