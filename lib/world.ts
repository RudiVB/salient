// lib/world.ts — Risk-style world territories placed on the globe by lat/lon.

export interface Territory {
  id: string;
  name: string;
  lat: number;   // degrees
  lon: number;   // degrees
  neighbors: string[];
}

// Raw definitions (adjacency is made symmetric at load — see below).
const RAW: Territory[] = [
  { id: "britain",     name: "British Isles",     lat: 54,  lon: -2,  neighbors: ["france", "lowlands", "iberia", "scandinavia", "n_america"] },
  { id: "iberia",      name: "Iberia",            lat: 40,  lon: -4,  neighbors: ["britain", "france", "maghreb"] },
  { id: "france",      name: "France",            lat: 47,  lon: 2,   neighbors: ["britain", "iberia", "lowlands", "germany", "italy"] },
  { id: "lowlands",    name: "Low Countries",     lat: 51,  lon: 5,   neighbors: ["britain", "france", "germany", "scandinavia"] },
  { id: "germany",     name: "Central Europe",    lat: 51,  lon: 10,  neighbors: ["france", "lowlands", "scandinavia", "austria", "poland", "italy"] },
  { id: "scandinavia", name: "Scandinavia",       lat: 62,  lon: 15,  neighbors: ["britain", "lowlands", "germany", "poland", "russia_w"] },
  { id: "italy",       name: "Italy",             lat: 43,  lon: 12,  neighbors: ["france", "germany", "austria", "balkans", "maghreb"] },
  { id: "austria",     name: "Austria-Hungary",   lat: 47,  lon: 16,  neighbors: ["germany", "italy", "balkans", "poland"] },
  { id: "balkans",     name: "The Balkans",       lat: 43,  lon: 22,  neighbors: ["italy", "austria", "poland", "ukraine", "anatolia"] },
  { id: "poland",      name: "Eastern Europe",    lat: 52,  lon: 21,  neighbors: ["germany", "scandinavia", "austria", "balkans", "russia_w", "ukraine"] },
  { id: "russia_w",    name: "Western Russia",    lat: 56,  lon: 38,  neighbors: ["scandinavia", "poland", "ukraine", "russia_e", "caucasus"] },
  { id: "russia_e",    name: "Siberia",           lat: 60,  lon: 90,  neighbors: ["russia_w", "caucasus", "india", "eastasia"] },
  { id: "ukraine",     name: "Ukraine",           lat: 49,  lon: 32,  neighbors: ["poland", "balkans", "russia_w", "caucasus"] },
  { id: "caucasus",    name: "Caucasus",          lat: 42,  lon: 45,  neighbors: ["russia_w", "russia_e", "ukraine", "anatolia", "levant", "india"] },
  { id: "anatolia",    name: "Anatolia",          lat: 39,  lon: 33,  neighbors: ["balkans", "caucasus", "levant", "egypt"] },
  { id: "levant",      name: "Middle East",       lat: 33,  lon: 38,  neighbors: ["caucasus", "anatolia", "egypt", "india"] },
  { id: "egypt",       name: "Egypt",             lat: 27,  lon: 30,  neighbors: ["anatolia", "levant", "maghreb", "westafrica"] },
  { id: "maghreb",     name: "North Africa",      lat: 32,  lon: 3,   neighbors: ["iberia", "italy", "egypt", "westafrica"] },
  { id: "westafrica",  name: "West Africa",       lat: 8,   lon: 0,   neighbors: ["maghreb", "egypt", "southafrica", "s_america"] },
  { id: "southafrica", name: "Southern Africa",   lat: -26, lon: 26,  neighbors: ["westafrica", "india"] },
  { id: "india",       name: "India",             lat: 22,  lon: 78,  neighbors: ["caucasus", "russia_e", "levant", "eastasia", "southafrica"] },
  { id: "eastasia",    name: "East Asia",         lat: 35,  lon: 110, neighbors: ["russia_e", "india", "japan"] },
  { id: "japan",       name: "Japan",             lat: 37,  lon: 138, neighbors: ["eastasia", "n_america"] },
  { id: "n_america",   name: "North America",     lat: 40,  lon: -90, neighbors: ["britain", "japan", "s_america"] },
  { id: "s_america",   name: "South America",     lat: -15, lon: -60, neighbors: ["n_america", "westafrica"] },
];

// make adjacency symmetric
const byId: Record<string, Territory> = Object.fromEntries(RAW.map((t) => [t.id, t]));
for (const t of RAW) for (const n of t.neighbors) {
  const o = byId[n];
  if (o && !o.neighbors.includes(t.id)) o.neighbors.push(t.id);
}

export const TERRITORIES = RAW;
export const TERRITORY = byId;

// which territory each nation starts holding
export const NATION_HOME: Record<string, string> = {
  germany: "germany", britain: "britain", france: "france", russia: "russia_w",
  austria: "austria", ottoman: "anatolia", italy: "italy", usa: "n_america",
  japan: "japan", belgium: "lowlands", serbia: "balkans", romania: "ukraine",
  southafrica: "southafrica", bulgaria: "balkans",
};

export type Owner = "player" | "enemy";

// seed ownership: player holds their home, everyone else is enemy
export function buildOwnership(nationId: string | null): Record<string, Owner> {
  const home = (nationId && NATION_HOME[nationId]) || "france";
  const out: Record<string, Owner> = {};
  for (const t of TERRITORIES) out[t.id] = t.id === home ? "player" : "enemy";
  return out;
}

// enemy territories adjacent to any player-owned territory (the legal attacks)
export function computeAttackable(own: Record<string, Owner>): Set<string> {
  const set = new Set<string>();
  for (const t of TERRITORIES) {
    if (own[t.id] !== "player") continue;
    for (const n of t.neighbors) if (own[n] === "enemy") set.add(n);
  }
  return set;
}

// lat/lon -> point on a sphere of radius r
export function latLonToXYZ(lat: number, lon: number, r: number): [number, number, number] {
  const phi = (90 - lat) * (Math.PI / 180);
  const theta = (lon + 180) * (Math.PI / 180);
  return [-r * Math.sin(phi) * Math.cos(theta), r * Math.cos(phi), r * Math.sin(phi) * Math.sin(theta)];
}
