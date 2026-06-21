"use client";
import { createContext, useContext, useEffect, useRef, useState } from "react";
import { UNITS, CATALOG, NATION_SPECIAL, fmt } from "@/lib/catalog";
import { NATION } from "@/lib/nations";
import { NATION_HOME, TERRITORY } from "@/lib/world";
import { recruitPrice, unitPower, rankFor, unitReqRank, VET_MAX, type RankInfo } from "@/lib/campaign";
import { genHero, addHeroXP, HERO_VET_THRESHOLD, XP_WIN, XP_LOSS, type Hero } from "@/lib/heroes";
import { seedWorld, worldFromOwned, worldTick as simTick, advanceTurns, territoryCounts, factionName, PLAYER_FACTION, type WorldState } from "@/lib/worldsim";
import { ROUTES, routeCost, TRADE_MAX, tradeIncomeTotal } from "@/lib/trade";
import { homelandEconList, foodNeed, nationPop, BMAP, buildingCost, PLOT_COUNT, type EconReport, type Plot, type Placed } from "@/lib/economy";
import { aggregateDoctrine, canResearch, DMAP, RESEARCH_WIN, RESEARCH_LOSS, type DoctrineBonus } from "@/lib/doctrine";
import { playSfx } from "@/lib/audio";

/* ---------------- types ---------------- */
export interface OwnedUnit { uid: string; defId: string; troops: number; vet?: number; hero?: Hero; }  // vet 0..5 = veterancy level; hero = named commander

export type NodeType = "battle" | "elite" | "supply" | "recruit" | "boss";
export interface MapNode { id: string; row: number; x: number; type: NodeType; region: string; next: string[]; }
export interface CampaignMap { nodes: MapNode[]; rows: number; regions: string[]; }

interface SaveData {
  supplies: number;
  collection: OwnedUnit[];
  map: CampaignMap | null;
  position: string | null;      // current node id, null = at the start
  cleared: string[];            // visited node ids
  nation: string | null;        // chosen power
  money: number;                // treasury (buy troops, unlock cards)
  income: number;               // legacy base (kept for compat)
  owned: string[];              // territory ids held (globe conquest)
  lastTick: number;             // ms timestamp for hourly income accrual
  trade: Record<string, number>;// route id -> level
  wins: number;                 // total battles won (drives commander rank)
  streak: number;               // current win streak (reward multiplier)
  bestStreak: number;           // record streak
  missions: string[];           // claimed mission ids
  buildings: Record<string, number>;  // legacy single-instance (kept for migration)
  plots: Plot[];                       // homeland building plots (multi-instance)
  population: number;           // citizens (millions) — home-front scale + food demand
  research: number;             // War Research points (doctrine currency)
  doctrines: string[];          // researched doctrine node ids
  world: WorldState;            // living faction map (Pillar 3)
  seenIntro?: boolean;          // has the player seen the welcome briefing
}

interface GameCtx extends SaveData {
  available: string[];          // node ids the player may pick next
  notice: string | null;
  reinforceCost: (u: OwnedUnit) => number;
  reinforce: (uid: string) => void;
  reinforceAll: () => void;
  selectNode: (id: string) => void;
  chooseNation: (id: string) => void;
  addMoney: (n: number) => void;
  takeCasualties: (uids: string[], factor: number) => void;
  applyLosses: (losses: { uid: string; after: number }[]) => void;   // set exact survivor counts
  incomePerHour: number;        // NET (gross − upkeep), can be negative
  grossIncome: number;
  upkeepPerHour: number;
  tradeIncome: number;
  tickIncome: () => void;
  upgradeRoute: (id: string) => boolean;
  captureTerritory: (id: string) => void;
  world: WorldState;
  worldTick: () => void;        // advance the living world one turn
  awayReport: AwayReport | null;   // "while you were away" summary
  dismissAway: () => void;
  markIntroSeen: () => void;
  reinforceGarrison: (id: string) => boolean;  // spend supplies to fortify a territory
  playerDefense: number;        // army-derived defence bonus on your territories
  recruit: (defId: string) => boolean;
  recruitCost: (defId: string) => number;   // scales with army size
  recordBattle: (won: boolean) => void;      // update wins + streak + research
  doctrine: DoctrineBonus;                    // aggregated researched bonuses
  researchDoctrine: (id: string) => boolean;  // spend research to unlock a node
  canResearch: (id: string) => boolean;
  awardVeterancy: (uids: string[]) => void;  // +1 vet to survivors
  progressHeroes: (survivorUids: string[], wipedUids: string[], won: boolean) => void;  // hero XP / promotion / KIA
  claimMission: (id: string, reward: number) => void;
  rank: RankInfo;
  // ---- homeland economy ----
  econ: EconReport;             // aggregated building output
  foodNeed: number;             // food the nation must produce / month
  starving: boolean;            // food shortfall → economy chokes
  newBuildCost: (type: string) => number;        // cost to place a NEW building
  upgradeCost: (plotIndex: number) => number;    // cost to upgrade a plot
  buildPlot: (plotIndex: number, type: string) => boolean;
  upgradePlot: (plotIndex: number) => boolean;
  demolishPlot: (plotIndex: number) => boolean;
  reset: () => void;
}

const REINFORCE_PER = 100;
const BASE_INCOME = 20;        // £/hr stipend
const PER_TERRITORY = 15;      // £/hr per region held
const SLOW_TURN_MS = 10 * 60 * 1000;   // background: one world turn every 10 real minutes
const MAX_OFFLINE_TURNS = 18;          // cap catch-up so a long absence stays digestible
export interface AwayReport { turns: number; lost: string[]; leaderName: string; leaderN: number; held: number; }
const UPKEEP_RATE = 0.03;      // £/hr per point of army power (bigger army = bigger drain)
const RECRUIT_SCALE = 0.18;    // each regiment you own adds 18% to the next recruit price
const SAVE_KEY = "ww1-autobattle-save-v2";
const REGIONS = ["The Marshes", "Belleau Wood", "Ruined Village", "The Ridge", "Enemy Salient"];
const ROWS_PER_REGION = 3;

/* ---------------- map generation (client-only) ---------------- */
function genMap(): CampaignMap {
  const totalRows = REGIONS.length * ROWS_PER_REGION;
  const nodes: MapNode[] = [];
  for (let r = 0; r < totalRows; r++) {
    const region = REGIONS[Math.floor(r / ROWS_PER_REGION)];
    const isFinal = r === totalRows - 1;
    const isRegionEnd = (r % ROWS_PER_REGION) === ROWS_PER_REGION - 1;
    const count = isFinal || isRegionEnd ? 1 : 1 + Math.floor(Math.random() * 3); // 1-3
    for (let c = 0; c < count; c++) {
      const x = count === 1 ? 0.5 : 0.16 + (c / (count - 1)) * 0.68;
      let type: NodeType = "battle";
      if (isFinal) type = "boss";
      else if (isRegionEnd) type = "elite";
      else { const rr = Math.random(); type = rr < 0.6 ? "battle" : rr < 0.74 ? "elite" : rr < 0.9 ? "supply" : "recruit"; }
      nodes.push({ id: `n${r}_${c}`, row: r, x, type, region, next: [] });
    }
  }
  // connect each node to 1-2 nearest nodes in the next row, ensure full reachability
  for (let r = 0; r < totalRows - 1; r++) {
    const cur = nodes.filter((n) => n.row === r);
    const nxt = nodes.filter((n) => n.row === r + 1);
    cur.forEach((n) => {
      const sorted = [...nxt].sort((a, b) => Math.abs(a.x - n.x) - Math.abs(b.x - n.x));
      const k = Math.min(nxt.length, 1 + (Math.random() < 0.5 ? 1 : 0));
      n.next = sorted.slice(0, k).map((x) => x.id);
    });
    nxt.forEach((nn) => {
      if (!cur.some((c) => c.next.includes(nn.id))) {
        const c = [...cur].sort((a, b) => Math.abs(a.x - nn.x) - Math.abs(b.x - nn.x))[0];
        c.next.push(nn.id);
      }
    });
  }
  return { nodes, rows: totalRows, regions: REGIONS };
}

function freshSave(): SaveData {
  const start: [string, number][] = [
    ["rifleman", 8000], ["grenadier", 5000], ["guard", 6200],
    ["mortar", 3000], ["medic", 2000], ["car", 1200], ["tank", 480],
  ];
  return {
    supplies: 240, money: 700, income: BASE_INCOME, owned: [], lastTick: Date.now(), trade: {},
    map: null, position: null, cleared: [], nation: null,
    wins: 0, streak: 0, bestStreak: 0, missions: [],
    buildings: {}, plots: Array.from({ length: PLOT_COUNT }, () => ({ type: null, level: 0 })), population: 12,
    research: 0, doctrines: [], world: seedWorld(null),
    collection: start.map(([defId, troops], i) => ({ uid: `${defId}_${i}`, defId, troops, vet: 0 })),
  };
}

/* ---------------- provider ---------------- */
const Ctx = createContext<GameCtx | null>(null);
export const useGame = () => { const c = useContext(Ctx); if (!c) throw new Error("useGame outside provider"); return c; };

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [data, setData] = useState<SaveData>(() => freshSave());
  const [notice, setNotice] = useState<string | null>(null);
  const [awayReport, setAwayReport] = useState<AwayReport | null>(null);
  const loaded = useRef(false);

  // load (or generate) on the client only — keeps SSR deterministic
  useEffect(() => {
    let base = freshSave();
    try { const raw = localStorage.getItem(SAVE_KEY); if (raw) base = { ...base, ...JSON.parse(raw) }; } catch {}
    if (!base.map) base = { ...base, map: genMap(), position: null, cleared: [] };
    // ---- migrate / normalise homeland plots ----
    let plots: Plot[] = Array.isArray(base.plots) ? base.plots.slice(0, PLOT_COUNT) : [];
    const hasBuilt = plots.some((p) => p && p.type);
    if (!hasBuilt && base.buildings && Object.keys(base.buildings).length) {
      // convert legacy {id:level} → one plot each
      plots = Object.entries(base.buildings).filter(([, l]) => (l as number) > 0).map(([type, level]) => ({ type, level: level as number }));
    }
    while (plots.length < PLOT_COUNT) plots.push({ type: null, level: 0 });
    base = { ...base, plots, research: base.research ?? 0, doctrines: Array.isArray(base.doctrines) ? base.doctrines : [] };
    // ---- living world (Pillar 3) ----
    if (!base.world || !base.world.owner) base = { ...base, world: worldFromOwned(base.nation, base.owned || []) };
    if (!base.world.lastTurnAt) base.world = { ...base.world, lastTurnAt: Date.now() };

    // ---- offline catch-up: advance the war for the time you were away ----
    if (base.nation) {
      const now = Date.now();
      const due = Math.floor((now - base.world.lastTurnAt) / SLOW_TURN_MS);
      if (due > 0) {
        const n = Math.min(MAX_OFFLINE_TURNS, due);
        const pow = base.collection.reduce((s, u) => s + unitPower(u.defId, u.troops), 0);
        const pd = Math.min(12, Math.floor(pow / 450));
        const { state, lostByPlayer } = advanceTurns(base.world, NATION[base.nation]?.name || "Your Empire", pd, n);
        const counts = territoryCounts(state);
        let leaderId = PLAYER_FACTION, leaderN = -1; for (const k in counts) if (counts[k] > leaderN) { leaderN = counts[k]; leaderId = k; }
        base = { ...base, world: { ...state, lastTurnAt: base.world.lastTurnAt + n * SLOW_TURN_MS }, owned: Object.keys(state.owner).filter((id) => state.owner[id] === PLAYER_FACTION) };
        if (n >= 2) setAwayReport({ turns: n, lost: Array.from(new Set(lostByPlayer)).map((id) => TERRITORY[id]?.name || id), leaderName: factionName(leaderId, NATION[base.nation]?.name || "You"), leaderN, held: base.owned.length });
      }
    }

    base = { ...base, owned: Object.keys(base.world.owner).filter((id) => base.world.owner[id] === PLAYER_FACTION) };
    setData(base);
    loaded.current = true;
  }, []);

  // ---- background world clock: keep advancing on ANY screen, in real time ----
  useEffect(() => {
    const iv = setInterval(() => setData((d) => {
      if (!d.nation || !d.world) return d;
      const now = Date.now();
      const due = Math.floor((now - d.world.lastTurnAt) / SLOW_TURN_MS);
      if (due <= 0) return d;
      const n = Math.min(MAX_OFFLINE_TURNS, due);
      const pow = d.collection.reduce((s, u) => s + unitPower(u.defId, u.troops), 0);
      const pd = Math.min(12, Math.floor(pow / 450));
      const { state, events, lostByPlayer } = advanceTurns(d.world, NATION[d.nation]?.name || "Your Empire", pd, n);
      if (lostByPlayer.length) setTimeout(() => setNotice(`⚠ ${TERRITORY[lostByPlayer[0]]?.name || "A region"} was lost while you commanded elsewhere`), 0);
      else if (events.length) setTimeout(() => setNotice(events[0]), 0);
      return { ...d, world: { ...state, lastTurnAt: d.world.lastTurnAt + n * SLOW_TURN_MS }, owned: Object.keys(state.owner).filter((id) => state.owner[id] === PLAYER_FACTION) };
    }), 60000);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => { if (!loaded.current) return; try { localStorage.setItem(SAVE_KEY, JSON.stringify(data)); } catch {} }, [data]);
  useEffect(() => { if (!notice) return; const t = setTimeout(() => setNotice(null), 2200); return () => clearTimeout(t); }, [notice]);

  /* available next nodes */
  const available: string[] = (() => {
    if (!data.map) return [];
    if (!data.position) return data.map.nodes.filter((n) => n.row === 0).map((n) => n.id);
    const cur = data.map.nodes.find((n) => n.id === data.position);
    return cur ? cur.next : [];
  })();

  const reinforceCost = (u: OwnedUnit) => Math.ceil(Math.max(0, CATALOG[u.defId].maxTroops - u.troops) / REINFORCE_PER * (1 - aggregateDoctrine(data.doctrines).reinforceDiscount));

  const reinforce = (uid: string) => { let ok = false; setData((d) => {
    const u = d.collection.find((x) => x.uid === uid); if (!u) return d;
    const max = CATALOG[u.defId].maxTroops;
    const cost = Math.ceil(Math.max(0, max - u.troops) / REINFORCE_PER);
    if (cost <= 0 || d.supplies < cost) return d;
    ok = true;
    return { ...d, supplies: d.supplies - cost, collection: d.collection.map((x) => x.uid === uid ? { ...x, troops: max } : x) };
  }); if (ok) playSfx("reinforce"); };

  const reinforceAll = () => { let spent = false; setData((d) => {
    let supplies = d.supplies;
    const collection = d.collection.map((u) => {
      const max = CATALOG[u.defId].maxTroops;
      const cost = Math.ceil(Math.max(0, max - u.troops) / REINFORCE_PER);
      if (cost > 0 && supplies >= cost) { supplies -= cost; return { ...u, troops: max }; }
      return u;
    });
    spent = supplies !== d.supplies;
    return { ...d, supplies, collection };
  }); if (spent) playSfx("reinforce"); };

  /* resolve a map node (battles are placeholder until Part 4) */
  const selectNode = (id: string) => setData((d) => {
    if (!available.includes(id) || !d.map) return d;
    const node = d.map.nodes.find((n) => n.id === id)!;
    let supplies = d.supplies;
    let collection = d.collection;
    let msg = "";

    if (node.type === "supply") {
      supplies += 90; msg = "Supply depot secured · +90 supplies";
    } else if (node.type === "recruit") {
      const def = UNITS[Math.floor(Math.random() * UNITS.length)];
      collection = [...collection, { uid: `${def.id}_${Date.now()}`, defId: def.id, troops: Math.round(def.maxTroops * 0.6) }];
      msg = `New regiment joined · ${def.name}`;
    } else {
      // battle / elite / boss — placeholder auto-resolve with attrition
      const factor = node.type === "boss" ? 0.26 : node.type === "elite" ? 0.16 : 0.08;
      collection = collection.map((u) => ({ ...u, troops: Math.max(0, Math.round(u.troops * (1 - factor * (0.7 + Math.random() * 0.6)))) }));
      const reward = node.type === "boss" ? 150 : node.type === "elite" ? 70 : 40;
      supplies += reward;
      msg = `${node.type === "boss" ? "Salient broken" : node.type === "elite" ? "Strongpoint taken" : "Sector cleared"} · +${reward} supplies`;
    }

    setNotice(msg);
    return { ...d, supplies, collection, position: id, cleared: [...d.cleared, id] };
  });

  const chooseNation = (id: string) => setData((d) => {
    const n = NATION[id]; if (!n) return d;
    let collection = d.collection;
    const sp = NATION_SPECIAL[id];
    if (sp && CATALOG[sp]) collection = [...collection, { uid: `${sp}_n${Date.now()}`, defId: sp, troops: CATALOG[sp].maxTroops, vet: 0 }];  // signature unit
    const home = NATION_HOME[id];
    // a fresh nation starts with a real war chest (R4M) and a small home economy
    const plots: Plot[] = Array.from({ length: PLOT_COUNT }, () => ({ type: null as string | null, level: 0 }));
    plots[0] = { type: "industry", level: 1 }; plots[1] = { type: "farm", level: 1 }; plots[2] = { type: "barracks", level: 1 };
    return {
      ...d, nation: id, supplies: d.supplies + (n.startSupplies || 0),
      money: Math.max(d.money, 4000), population: nationPop(id),
      research: Math.max(d.research || 0, 4), world: seedWorld(id),
      buildings: {}, plots,
      owned: home ? [home] : [], lastTick: Date.now(), collection,
    };
  });

  const addMoney = (n: number) => { if (n > 0) playSfx("coin"); setData((d) => ({ ...d, money: Math.max(0, d.money + n) })); };

  // apply battle losses to the deployed regiments (factor 0..1; wiped units hit 0)
  const takeCasualties = (uids: string[], factor: number) => setData((d) => ({
    ...d,
    collection: d.collection.map((u) => uids.includes(u.uid)
      ? { ...u, troops: Math.max(0, Math.round(u.troops * (1 - factor * (0.7 + Math.random() * 0.6)))) }
      : u),
  }));

  // set exact survivor counts (used by battles so the casualty report matches reality)
  const applyLosses = (losses: { uid: string; after: number }[]) => setData((d) => ({
    ...d,
    collection: d.collection.map((u) => { const L = losses.find((x) => x.uid === u.uid); return L ? { ...u, troops: Math.max(0, Math.round(L.after)) } : u; }),
  }));

  const tradeIncome = tradeIncomeTotal(data.trade);
  const doctrine = aggregateDoctrine(data.doctrines);
  const placed: Placed[] = (data.plots || []).filter((p) => p.type && p.level > 0).map((p) => ({ type: p.type as string, level: p.level }));
  const econ = homelandEconList(placed);
  const totalTroops = data.collection.reduce((s, u) => s + u.troops, 0);
  const need = foodNeed(totalTroops);
  const starving = econ.food < need;
  const grossIncome = Math.round((BASE_INCOME + (data.owned?.length || 0) * PER_TERRITORY + tradeIncome + econ.income) * doctrine.incomeMult);
  const upkeepPerHour = Math.round(data.collection.reduce((s, u) => s + unitPower(u.defId, u.troops), 0) * UPKEEP_RATE);
  const rawNet = grossIncome - upkeepPerHour;
  const incomePerHour = starving ? Math.round(rawNet * 0.5) : rawNet;   // starvation chokes the economy

  // credit accrued NET income since lastTick (works while away too; can drain the treasury)
  const tickIncome = () => setData((d) => {
    const now = Date.now();
    const hrs = Math.max(0, (now - (d.lastTick || now)) / 3600000);
    const pl: Placed[] = (d.plots || []).filter((p) => p.type && p.level > 0).map((p) => ({ type: p.type as string, level: p.level }));
    const e = homelandEconList(pl);
    const troops = d.collection.reduce((s, u) => s + u.troops, 0);
    const hungry = e.food < foodNeed(troops);
    const gross = (BASE_INCOME + (d.owned?.length || 0) * PER_TERRITORY + tradeIncomeTotal(d.trade) + e.income) * aggregateDoctrine(d.doctrines).incomeMult;
    const upkeep = Math.round(troops > 0 ? d.collection.reduce((s, u) => s + unitPower(u.defId, u.troops), 0) * UPKEEP_RATE : 0);
    let net = gross - upkeep; if (hungry) net = Math.round(net * 0.5);
    if (net * hrs > 0.0001) playSfx("coin");             // money came in (only when net positive)
    return { ...d, money: Math.max(0, d.money + net * hrs), supplies: d.supplies + e.supplies * hrs, lastTick: now };
  });

  const upgradeRoute = (id: string): boolean => {
    let ok = false;
    setData((d) => {
      const lvl = d.trade?.[id] || 0;
      if (lvl >= TRADE_MAX) return d;
      const route = ROUTES.find((r) => r.id === id);
      if (route?.reqTerritory && (d.owned?.length || 0) < route.reqTerritory) return d;
      const cost = routeCost(id, lvl);
      if (d.money < cost) return d;
      ok = true;
      return { ...d, money: d.money - cost, trade: { ...(d.trade || {}), [id]: lvl + 1 } };
    });
    if (ok) playSfx("purchase");
    return ok;
  };

  const captureTerritory = (id: string) => setData((d) => {
    if (d.owned?.includes(id)) return d;
    const w = d.world;
    const garrison = { ...w.garrison, [id]: Math.max(6, Math.floor((w.garrison[id] || 4) * 0.6) + 4) };
    const owner = { ...w.owner, [id]: PLAYER_FACTION };
    const log = [`✚ You captured ${TERRITORY[id]?.name || id}.`, ...w.log].slice(0, 14);
    return { ...d, owned: [...(d.owned || []), id], world: { ...w, owner, garrison, log } };
  });

  // advance the living world one turn (manual/fast — used while watching the map)
  const worldTick = () => setData((d) => {
    if (!d.world) return d;
    const pow = d.collection.reduce((s, u) => s + unitPower(u.defId, u.troops), 0);
    const pd = Math.min(12, Math.floor(pow / 450));   // your standing army fortifies your land
    const { state, events, lostByPlayer } = simTick(d.world, NATION[d.nation || ""]?.name || "Your Empire", pd);
    const owned = (d.owned || []).filter((id) => !lostByPlayer.includes(id));
    if (events.length) setTimeout(() => setNotice(events[0]), 0);
    return { ...d, world: { ...state, lastTurnAt: Date.now() }, owned };
  });

  // spend supplies to fortify an owned territory
  const GARRISON_CAP = 14, SUPPLY_PER_GARRISON = 12;
  const reinforceGarrison = (id: string): boolean => {
    let ok = false;
    setData((d) => {
      if (d.world.owner[id] !== PLAYER_FACTION) return d;
      const g = d.world.garrison[id] || 0; if (g >= GARRISON_CAP) return d;
      if (d.supplies < SUPPLY_PER_GARRISON) return d;
      ok = true;
      return { ...d, supplies: d.supplies - SUPPLY_PER_GARRISON, world: { ...d.world, garrison: { ...d.world.garrison, [id]: g + 1 } } };
    });
    if (ok) playSfx("purchase");
    return ok;
  };

  const recruitCost = (defId: string) => Math.round(recruitPrice(defId) * (1 + RECRUIT_SCALE * data.collection.length) * (1 - econ.recruitDiscount) * (1 - doctrine.recruitDiscount));

  const recruit = (defId: string): boolean => {
    const price = recruitCost(defId); let ok = false;
    setData((d) => {
      if (d.money < price || !CATALOG[defId]) return d;
      if (unitReqRank(defId) > rankFor(d.wins || 0).index) return d;   // rank-locked
      ok = true;
      return { ...d, money: d.money - price, collection: [...d.collection, { uid: `${defId}_r${Date.now()}`, defId, troops: CATALOG[defId].maxTroops, vet: 0 }] };
    });
    if (ok) playSfx("purchase");
    return ok;
  };

  // record a battle outcome → commander rank + win streak + War Research
  const recordBattle = (won: boolean) => setData((d) => {
    const research = (d.research || 0) + (won ? RESEARCH_WIN : RESEARCH_LOSS);
    if (won) { const streak = (d.streak || 0) + 1; return { ...d, research, wins: (d.wins || 0) + 1, streak, bestStreak: Math.max(d.bestStreak || 0, streak) }; }
    return { ...d, research, streak: 0 };
  });

  // spend War Research to unlock a doctrine node
  const researchDoctrine = (id: string): boolean => {
    let ok = false;
    setData((d) => {
      const node = DMAP[id]; if (!node) return d;
      if ((d.doctrines || []).includes(id)) return d;
      if (node.req && !(d.doctrines || []).includes(node.req)) return d;
      if ((d.research || 0) < node.cost) return d;
      ok = true;
      return { ...d, research: d.research - node.cost, doctrines: [...(d.doctrines || []), id] };
    });
    if (ok) playSfx("purchase");
    return ok;
  };
  const canResearchFn = (id: string) => canResearch(id, data.doctrines || [], data.research || 0);

  // survivors of a victory gain veterancy
  const awardVeterancy = (uids: string[]) => setData((d) => ({
    ...d,
    collection: d.collection.map((u) => uids.includes(u.uid) && u.troops > 0 ? { ...u, vet: Math.min(VET_MAX, (u.vet || 0) + 1) } : u),
  }));

  // hero progression: survivors gain XP (+ first promotion at the vet threshold); wiped commanders fall
  const hashUid = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
  const progressHeroes = (survivorUids: string[], wipedUids: string[], won: boolean) => {
    let msg = "";
    setData((d) => ({
      ...d,
      collection: d.collection.map((u) => {
        if (wipedUids.includes(u.uid) && u.hero) { if (!msg) msg = `☠ Cmdr. ${u.hero.name} fell in battle`; return { ...u, hero: undefined }; }
        if (survivorUids.includes(u.uid)) {
          if (u.hero) return { ...u, hero: addHeroXP(u.hero, won ? XP_WIN : XP_LOSS) };
          if (won && (u.vet || 0) >= HERO_VET_THRESHOLD) { const h = genHero(hashUid(u.uid)); if (!msg) msg = `★ Cmdr. ${h.name} now leads ${CATALOG[u.defId]?.name || "a regiment"}`; return { ...u, hero: h }; }
        }
        return u;
      }),
    }));
    if (msg) setNotice(msg);
  };

  const rank = rankFor(data.wins || 0);

  const claimMission = (id: string, reward: number) => setData((d) => {
    if ((d.missions || []).includes(id)) return d;
    playSfx("coin");
    return { ...d, money: d.money + reward, missions: [...(d.missions || []), id] };
  });

  // ---- homeland building (multi-plot) ----
  const placedCount = (data.plots || []).filter((p) => p.type).length;
  const newBuildCost = (type: string) => { const def = BMAP[type]; if (!def) return 0; return Math.round(def.baseCost * (1 + 0.35 * placedCount)); };
  const upgradeCost = (i: number) => { const p = data.plots?.[i]; if (!p || !p.type) return 0; return buildingCost(BMAP[p.type], p.level); };

  const buildPlot = (i: number, type: string): boolean => {
    let ok = false;
    setData((d) => {
      const def = BMAP[type]; if (!def) return d;
      const plots = [...(d.plots || [])]; const p = plots[i];
      if (!p || p.type) return d;                                   // plot must be empty
      const count = plots.filter((x) => x.type).length;
      const cost = Math.round(def.baseCost * (1 + 0.35 * count));
      if (d.money < cost) return d;
      plots[i] = { type, level: 1 }; ok = true;
      return { ...d, money: d.money - cost, plots };
    });
    if (ok) playSfx("purchase");
    return ok;
  };
  const upgradePlot = (i: number): boolean => {
    let ok = false;
    setData((d) => {
      const plots = [...(d.plots || [])]; const p = plots[i];
      if (!p || !p.type) return d; const def = BMAP[p.type];
      if (p.level >= def.max) return d;
      const cost = buildingCost(def, p.level); if (d.money < cost) return d;
      plots[i] = { ...p, level: p.level + 1 }; ok = true;
      return { ...d, money: d.money - cost, plots };
    });
    if (ok) playSfx("purchase");
    return ok;
  };
  const demolishPlot = (i: number): boolean => {
    let ok = false;
    setData((d) => {
      const plots = [...(d.plots || [])]; const p = plots[i];
      if (!p || !p.type) return d; const def = BMAP[p.type];
      const refund = Math.round(def.baseCost * p.level * 0.4);       // 40% salvage
      plots[i] = { type: null, level: 0 }; ok = true;
      return { ...d, money: d.money + refund, plots };
    });
    if (ok) playSfx("coin");
    return ok;
  };

  const reset = () => { setData({ ...freshSave(), map: genMap() }); setNotice(null); };

  return (
    <Ctx.Provider value={{ ...data, available, notice, reinforceCost, reinforce, reinforceAll, selectNode, chooseNation, addMoney, takeCasualties, applyLosses, incomePerHour, grossIncome, upkeepPerHour, tradeIncome, tickIncome, upgradeRoute, captureTerritory, worldTick, awayReport, dismissAway: () => setAwayReport(null), markIntroSeen: () => setData((d) => ({ ...d, seenIntro: true })), reinforceGarrison, playerDefense: Math.min(12, Math.floor(data.collection.reduce((s, u) => s + unitPower(u.defId, u.troops), 0) / 450)), recruit, recruitCost, recordBattle, doctrine, researchDoctrine, canResearch: canResearchFn, awardVeterancy, progressHeroes, claimMission, rank, econ, foodNeed: need, starving, newBuildCost, upgradeCost, buildPlot, upgradePlot, demolishPlot, reset }}>
      {children}
    </Ctx.Provider>
  );
}
