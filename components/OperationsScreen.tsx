"use client";
import { useState, useMemo } from "react";
import PolyScene from "@/components/PolyScene";
import BattleScene from "@/components/BattleScene";
import { useGame } from "@/lib/store";
import { CATALOG, fmt } from "@/lib/catalog";
import { randMoney } from "@/lib/economy";
import { NATION } from "@/lib/nations";
import { armyPower, armyPowerVet, genSkirmishArmy } from "@/lib/campaign";
import { heroArmyBonus, heroCasualtyMult } from "@/lib/heroes";
import { TERRAINS, TACTICS, effectivePower, casualtyFactor } from "@/lib/combat";

/**
 * OperationsScreen — replaces the old campaign tabs. components/OperationsScreen.tsx
 * Tabs: Missions (progression line) · Skirmish (vs bots) · Online (PvP scaffold).
 * Props: onBack, onWorld, onBarracks
 */
type Tab = "missions" | "skirmish" | "online";
interface Battle { winChance: number; before: number; rewardIfWin: number; uids: string[]; player: { defId: string; troops: number; vet?: number }[]; enemy: { defId: string; troops: number }[]; }
interface Casualty { uid: string; defId: string; name: string; before: number; lost: number; after: number; }
interface Result { won: boolean; reward: number; moneyLost: number; casualties: Casualty[]; totalLost: number; vetGained: number; }
const hashStr = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0); };

interface Mission { id: string; title: string; desc: string; target: number; reward: number; prog: (g: ReturnType<typeof useGame>) => number; }
const MISSIONS: Mission[] = [
  { id: "win3", title: "Blooded", desc: "Win 3 battles", target: 3, reward: 150, prog: (g) => g.wins },
  { id: "trade1", title: "War Economy", desc: "Open any trade route", target: 1, reward: 180, prog: (g) => Object.values(g.trade || {}).filter((l) => l > 0).length },
  { id: "hold2", title: "Foothold", desc: "Hold 2 territories", target: 2, reward: 220, prog: (g) => g.owned?.length || 0 },
  { id: "rankCpt", title: "Promotion", desc: "Reach the rank of Captain", target: 1, reward: 250, prog: (g) => (g.rank.index >= 1 ? 1 : 0) },
  { id: "vet3", title: "Old Guard", desc: "Raise a regiment to 3★ veterancy", target: 3, reward: 300, prog: (g) => Math.max(0, ...g.collection.map((u) => u.vet || 0), 0) },
  { id: "streak5", title: "On a Roll", desc: "Reach a 5-win streak", target: 5, reward: 320, prog: (g) => g.bestStreak || 0 },
  { id: "hold5", title: "Warlord", desc: "Hold 5 territories", target: 5, reward: 500, prog: (g) => g.owned?.length || 0 },
  { id: "win15", title: "Field General", desc: "Win 15 battles", target: 15, reward: 700, prog: (g) => g.wins },
];

const DIFFS = [
  { key: 1, name: "Skirmish", sub: "Weaker enemy", col: "#4fd190" },
  { key: 2, name: "Pitched Battle", sub: "Even match", col: "#56b9cf" },
  { key: 3, name: "Last Stand", sub: "Outnumbered", col: "#e5414f" },
] as const;

export default function OperationsScreen({ onBack, onWorld, onBarracks }: { onBack?: () => void; onWorld?: () => void; onBarracks?: () => void }) {
  const game = useGame();
  const accent = (game.nation && NATION[game.nation]?.accent) || "#56b9cf";
  const [tab, setTab] = useState<Tab>("missions");
  const [phase, setPhase] = useState<"menu" | "fighting" | "result">("menu");
  const [battle, setBattle] = useState<Battle | null>(null);
  const [result, setResult] = useState<Result | null>(null);

  const live = useMemo(() => game.collection.filter((u) => u.troops > 0), [game.collection]);
  const yourPower = armyPowerVet(live);
  const terrain = useMemo(() => TERRAINS[Math.floor(Math.random() * TERRAINS.length)], []);
  const [tacticId, setTacticId] = useState(TACTICS[0].id);
  const tactic = TACTICS.find((t) => t.id === tacticId) || TACTICS[0];

  const startSkirmish = (difficulty: number) => {
    if (live.length === 0) return;
    const enemy = genSkirmishArmy(yourPower, difficulty);
    const before = live.reduce((s, u) => s + u.troops, 0);
    const hb = heroArmyBonus(live);
    const pEff = effectivePower(live, enemy, terrain, tactic) * game.doctrine.powerMult * hb.powerMult;
    const eEff = effectivePower(enemy, live, terrain, null);
    const winChance = Math.round(Math.min(96, Math.max(4, (pEff / (pEff + eEff || 1)) * 100 + game.doctrine.winChanceAdd + hb.winChanceAdd)));
    setBattle({
      winChance, before, rewardIfWin: Math.round(armyPower(enemy) * 0.55) + 60 + difficulty * 40,
      uids: live.map((u) => u.uid),
      player: live.map((u) => ({ defId: u.defId, troops: u.troops, vet: u.vet })),
      enemy,
    });
    setPhase("fighting");
  };

  const resolveSkirmish = (won: boolean, effort: number) => {
    if (!battle) return;
    const factor = casualtyFactor(battle.player, battle.enemy, terrain, tactic, won, effort) * game.doctrine.casualtyMult;
    const heroOf = (uid: string) => game.collection.find((u) => u.uid === uid)?.hero;
    const casualties: Casualty[] = battle.player.map((u, i) => {
      const uid = battle.uids[i];
      const j = (hashStr(uid) % 1000) / 1000;
      const frac = Math.min(1, factor * (0.75 + j * 0.5) * heroCasualtyMult(heroOf(uid)));
      const lost = Math.round(u.troops * frac);
      return { uid, defId: u.defId, name: CATALOG[u.defId]?.name || u.defId, before: u.troops, lost, after: Math.max(0, u.troops - lost) };
    });
    game.applyLosses(casualties.map((c) => ({ uid: c.uid, after: c.after })));
    const totalLost = casualties.reduce((s, c) => s + c.lost, 0);
    const survivors = casualties.filter((c) => c.after > 0).map((c) => c.uid);
    const wiped = casualties.filter((c) => c.after <= 0).map((c) => c.uid);
    let moneyLost = 0, reward = 0, vetGained = 0;
    if (won) { reward = battle.rewardIfWin; game.addMoney(reward); game.awardVeterancy(survivors); vetGained = survivors.length; }
    else { moneyLost = Math.round(game.money * 0.06) + 20; game.addMoney(-moneyLost); }
    game.progressHeroes(survivors, wiped, won);
    game.recordBattle(won);
    setResult({ won, reward, moneyLost, casualties, totalLost, vetGained });
    setBattle(null);
    setPhase("result");
  };

  if (phase === "fighting" && battle) {
    return <BattleScene player={battle.player} enemy={battle.enemy} accent={accent} rungName="Bot Army"
      terrainName={terrain.name} terrainId={terrain.id} tacticName={tactic.name} winChance={battle.winChance}
      matchup={battle.winChance >= 56 ? "advantage" : battle.winChance <= 44 ? "disadvantage" : "even"}
      onResolve={resolveSkirmish} />;
  }

  return (
    <div className="op">
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="op-bg"><PolyScene className="op-scene" /></div>
      <div className="op-shade" />

      <div className="op-top">
        <button className="op-back" onClick={onBack}>← Command HQ</button>
        <div className="op-title">OPERATIONS</div>
        <div className="op-rank">{game.rank.name}</div>
      </div>

      <div className="op-tabs">
        <button className={"op-tab" + (tab === "missions" ? " on" : "")} onClick={() => setTab("missions")}>Missions</button>
        <button className={"op-tab" + (tab === "skirmish" ? " on" : "")} onClick={() => setTab("skirmish")}>Skirmish</button>
        <button className={"op-tab" + (tab === "online" ? " on" : "")} onClick={() => setTab("online")}>Online</button>
      </div>

      <div className="op-body">
        {tab === "missions" && (
          <div className="op-missions">
            <div className="op-lead">Complete objectives to earn war funds and climb the ranks.</div>
            {MISSIONS.map((m) => {
              const p = m.prog(game); const done = p >= m.target;
              const claimed = (game.missions || []).includes(m.id);
              return (
                <div key={m.id} className={"op-mission" + (done ? " done" : "") + (claimed ? " claimed" : "")}>
                  <div className="op-mMain">
                    <div className="op-mTitle">{m.title}{claimed && <span className="op-tick"> ✓</span>}</div>
                    <div className="op-mDesc">{m.desc}</div>
                    <div className="op-mBar"><i style={{ width: `${Math.min(100, (p / m.target) * 100)}%` }} /></div>
                    <div className="op-mProg">{Math.min(p, m.target)} / {m.target}</div>
                  </div>
                  <div className="op-mRight">
                    <div className="op-mReward">{randMoney(m.reward)}</div>
                    {claimed
                      ? <span className="op-mState">Claimed</span>
                      : <button className="op-claim" disabled={!done} onClick={() => game.claimMission(m.id, m.reward)}>{done ? "Claim" : "Locked"}</button>}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {tab === "skirmish" && (
          <div className="op-skirm">
            <div className="op-lead">Throw your whole army at a generated bot force. No territory at stake — just funds, veterancy, and rank.</div>
            <div className="op-armyLine">Your force: <b style={{ color: accent }}>{live.length} regiments</b> · <b>⚔ {fmt(yourPower)}</b> power</div>
            {live.length > 0 && (
              <>
                <div className="op-terr"><span>TERRAIN</span> <b>{terrain.name}</b> — {terrain.blurb}</div>
                <div className="op-tacHead">CHOOSE YOUR TACTIC</div>
                <div className="op-tacs">
                  {TACTICS.map((t) => (
                    <button key={t.id} className={"op-tac" + (t.id === tacticId ? " on" : "")} onClick={() => setTacticId(t.id)}>
                      <b>{t.name}</b><em>{t.desc}</em>
                    </button>
                  ))}
                </div>
              </>
            )}
            {live.length === 0
              ? <div className="op-empty">You have no regiments able to fight. Reinforce or recruit in the <button className="op-link" onClick={onBarracks}>Barracks</button>.</div>
              : (
                <div className="op-diffs">
                  {DIFFS.map((d) => (
                    <button key={d.key} className="op-diff" style={{ ["--dc" as any]: d.col }} onClick={() => startSkirmish(d.key)}>
                      <div className="op-diffName" style={{ color: d.col }}>{d.name}</div>
                      <div className="op-diffSub">{d.sub}</div>
                    </button>
                  ))}
                </div>
              )}
          </div>
        )}

        {tab === "online" && (
          <div className="op-online">
            <div className="op-onCard">
              <div className="op-onIcon">🌐</div>
              <div className="op-onTitle">Versus Commander</div>
              <div className="op-onDesc">Head-to-head battles against other players. This activates once the game is connected to your Supabase backend on Vercel — matchmaking, army submission, and resolved battles are all scaffolded and ready to wire up.</div>
              <div className="op-onTags"><span>Matchmaking</span><span>Async battles</span><span>Leaderboard</span></div>
              <button className="op-onBtn" onClick={() => setTab("skirmish")}>Practice vs bots for now ▸</button>
            </div>
          </div>
        )}
      </div>

      {/* skirmish result */}
      {phase === "result" && result && (
        <div className="op-resultWrap">
          <div className={"op-result " + (result.won ? "win" : "loss")}>
            <div className="op-rKick">{result.won ? "VICTORY" : "DEFEATED"}</div>
            <div className="op-rTitle">{result.won ? "The bot army is broken" : "Your attack was thrown back"}</div>
            <div className="op-rStats">
              <div><span>TOTAL CASUALTIES</span><b style={{ color: "#e5414f" }}>−{fmt(result.totalLost)}</b></div>
              {result.won
                ? <div><span>REWARD</span><b style={{ color: "#f0c860" }}>+{randMoney(result.reward)}</b></div>
                : <div><span>LOST FUNDS</span><b style={{ color: "#e5414f" }}>−{randMoney(result.moneyLost)}</b></div>}
              {result.won && result.vetGained > 0 && <div><span>VETERANS</span><b style={{ color: "#4fd190" }}>★ {result.vetGained}</b></div>}
            </div>
            <div className="op-cas">
              <div className="op-casHead">CASUALTY REPORT</div>
              {result.casualties.map((c) => {
                const pct = c.before > 0 ? c.after / c.before : 0; const wiped = c.after <= 0;
                return (
                  <div key={c.uid} className="op-casRow">
                    <div className="op-casName">{c.name}{wiped && <span className="op-wiped">WIPED OUT</span>}</div>
                    <div className="op-casBar"><i style={{ width: `${pct * 100}%` }} /></div>
                    <div className="op-casNum">{fmt(c.after)}<em>/{fmt(c.before)}</em> <s>−{fmt(c.lost)}</s></div>
                  </div>
                );
              })}
            </div>
            <button className="op-rCont" onClick={() => { setResult(null); setPhase("menu"); }}>Continue ▸</button>
          </div>
        </div>
      )}
    </div>
  );
}

const CSS = `
.op { position: fixed; inset: 0; z-index: 20; overflow-y: auto; font-family: 'Oswald', system-ui, sans-serif; color: #eef2fa;
  background: radial-gradient(120% 90% at 50% 8%, #1a2436 0%, #0a0e16 60%, #07090f 100%); }
.op-bg { position: fixed; inset: 0; z-index: 0; opacity: .5; } .op-scene { position: absolute; inset: 0; }
.op-shade { position: fixed; inset: 0; z-index: 1; pointer-events: none; background: radial-gradient(120% 100% at 50% 40%, rgba(7,9,15,.4), rgba(7,9,15,.85)); }

.op-top { position: relative; z-index: 2; display: flex; align-items: center; gap: 14px; padding: 18px 22px; max-width: 880px; margin: 0 auto; }
.op-back { cursor: pointer; font-family: 'Space Grotesk', monospace; font-size: 12px; letter-spacing: 2px; color: #aebbd2;
  background: rgba(20,30,46,.6); border: 1px solid rgba(120,150,190,.2); padding: 9px 14px; border-radius: 7px; }
.op-back:hover { color: #fff; }
.op-title { font-size: 26px; font-weight: 700; letter-spacing: 5px; margin-left: 4px; }
.op-rank { margin-left: auto; font-family: 'Space Grotesk', monospace; font-size: 12px; letter-spacing: 2px; color: #f0c860; }

.op-tabs { position: relative; z-index: 2; display: flex; gap: 8px; padding: 0 22px; max-width: 880px; margin: 0 auto 4px; }
.op-tab { cursor: pointer; font-family: 'Oswald'; font-size: 15px; letter-spacing: 2px; color: #93a2bd;
  background: rgba(16,24,38,.6); border: 1px solid rgba(120,150,190,.16); padding: 10px 18px;
  clip-path: polygon(0 6px,6px 0,calc(100% - 6px) 0,100% 6px,100% calc(100% - 6px),calc(100% - 6px) 100%,6px 100%,0 calc(100% - 6px)); }
.op-tab.on { color: #06222b; background: #56b9cf; border-color: #56b9cf; }

.op-body { position: relative; z-index: 2; max-width: 880px; margin: 14px auto 60px; padding: 0 22px; }
.op-lead { color: #aab8d0; font-size: 14px; margin-bottom: 16px; font-weight: 300; }

/* missions */
.op-mission { display: flex; align-items: center; gap: 16px; padding: 14px 16px; margin-bottom: 10px;
  background: linear-gradient(180deg, rgba(18,26,40,.85), rgba(11,17,27,.9)); border: 1px solid rgba(120,150,190,.14);
  clip-path: polygon(0 8px,8px 0,calc(100% - 8px) 0,100% 8px,100% calc(100% - 8px),calc(100% - 8px) 100%,8px 100%,0 calc(100% - 8px)); }
.op-mission.done { border-color: rgba(79,209,144,.4); }
.op-mission.claimed { opacity: .6; }
.op-mMain { flex: 1; }
.op-mTitle { font-size: 17px; letter-spacing: 1px; }
.op-tick { color: #4fd190; }
.op-mDesc { color: #93a2bd; font-size: 13px; margin: 2px 0 8px; }
.op-mBar { height: 6px; background: rgba(150,180,225,.14); border-radius: 99px; overflow: hidden; }
.op-mBar i { display: block; height: 100%; background: linear-gradient(90deg, #f0c860, #56b9cf); transition: width .4s; }
.op-mProg { font-family: 'Space Grotesk', monospace; font-size: 11px; color: #7d8ba6; margin-top: 5px; }
.op-mRight { text-align: right; min-width: 92px; }
.op-mReward { color: #f0c860; font-family: 'Space Grotesk', monospace; font-size: 15px; margin-bottom: 6px; }
.op-claim { cursor: pointer; font-family: 'Oswald'; font-size: 13px; letter-spacing: 1px; color: #06222b; background: #4fd190; border: none; padding: 7px 14px; border-radius: 5px; }
.op-claim:disabled { background: rgba(150,180,225,.16); color: #6b7790; cursor: not-allowed; }
.op-mState { font-family: 'Space Grotesk', monospace; font-size: 11px; color: #4fd190; }

/* skirmish */
.op-armyLine { font-size: 15px; color: #cfdaec; margin-bottom: 18px; }
.op-diffs { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
.op-diff { cursor: pointer; text-align: left; padding: 18px 16px; background: rgba(16,24,38,.7); border: 1px solid var(--dc);
  clip-path: polygon(0 8px,8px 0,calc(100% - 8px) 0,100% 8px,100% calc(100% - 8px),calc(100% - 8px) 100%,8px 100%,0 calc(100% - 8px)); transition: filter .15s; }
.op-diff:hover { filter: brightness(1.15); }
.op-diffName { font-size: 18px; letter-spacing: 1px; }
.op-diffSub { color: #93a2bd; font-size: 12px; margin-top: 3px; }
.op-empty { color: #aab8d0; font-size: 14px; }
.op-link, .op-onBtn { background: none; border: none; color: #56b9cf; cursor: pointer; font: inherit; text-decoration: underline; padding: 0; }

/* online */
.op-online { display: flex; justify-content: center; padding-top: 10px; }
.op-onCard { max-width: 460px; text-align: center; padding: 28px 26px; background: linear-gradient(180deg, rgba(18,26,40,.9), rgba(11,17,27,.92));
  border: 1px solid rgba(120,150,190,.16);
  clip-path: polygon(0 12px,12px 0,calc(100% - 12px) 0,100% 12px,100% calc(100% - 12px),calc(100% - 12px) 100%,12px 100%,0 calc(100% - 12px)); }
.op-onIcon { font-size: 40px; }
.op-onTitle { font-size: 24px; letter-spacing: 3px; margin: 8px 0 10px; }
.op-onDesc { color: #aab8d0; font-size: 14px; font-weight: 300; line-height: 1.5; }
.op-onTags { display: flex; gap: 8px; justify-content: center; margin: 16px 0; flex-wrap: wrap; }
.op-onTags span { font-family: 'Space Grotesk', monospace; font-size: 11px; letter-spacing: 1px; color: #7d8ba6;
  border: 1px solid rgba(120,150,190,.2); padding: 5px 10px; border-radius: 99px; }
.op-onBtn { text-decoration: none; font-family: 'Oswald'; letter-spacing: 1px; color: #06222b; background: #56b9cf; padding: 11px 20px; border-radius: 6px; margin-top: 6px; }

/* result */
.op-resultWrap { position: fixed; inset: 0; z-index: 30; display: flex; align-items: center; justify-content: center; padding: 20px;
  background: rgba(5,7,12,.72); -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px); }
.op-result { width: min(420px, 92vw); text-align: center; padding: 28px 26px;
  background: linear-gradient(180deg, rgba(18,26,40,.96), rgba(11,17,27,.98)); border: 1px solid rgba(120,150,190,.2);
  clip-path: polygon(0 12px,12px 0,calc(100% - 12px) 0,100% 12px,100% calc(100% - 12px),calc(100% - 12px) 100%,12px 100%,0 calc(100% - 12px)); }
.op-result.win { border-color: rgba(79,209,144,.5); } .op-result.loss { border-color: rgba(229,65,79,.5); }
.op-rKick { font-family: 'Space Grotesk', monospace; letter-spacing: 5px; font-size: 14px; color: #f0c860; }
.op-result.loss .op-rKick { color: #e5414f; }
.op-rTitle { font-size: 22px; letter-spacing: 1px; margin: 8px 0 18px; }
.op-rStats { display: flex; justify-content: center; gap: 30px; margin-bottom: 16px; flex-wrap: wrap; }
.op-cas { background: rgba(0,0,0,.22); border: 1px solid rgba(120,150,190,.16); border-radius: 8px; padding: 11px 13px; margin-bottom: 16px; text-align: left; max-width: 460px; margin-left: auto; margin-right: auto; }
.op-casHead { font-family: 'Space Grotesk', monospace; font-size: 10px; letter-spacing: 2px; color: #8194b4; margin-bottom: 9px; }
.op-casRow { display: grid; grid-template-columns: 1fr 80px auto; align-items: center; gap: 10px; margin-bottom: 7px; }
.op-casName { font-size: 12.5px; color: #d6e0ef; display: flex; align-items: center; gap: 7px; min-width: 0; }
.op-wiped { font-family: 'Oswald'; font-size: 9px; letter-spacing: 1px; color: #fff; background: #b3242f; padding: 1px 5px; border-radius: 3px; white-space: nowrap; }
.op-casBar { height: 8px; background: rgba(229,65,79,.4); border-radius: 4px; overflow: hidden; }
.op-casBar i { display: block; height: 100%; background: linear-gradient(90deg,#4fd190,#7fe0ad); }
.op-casNum { font-family: 'Space Grotesk', monospace; font-size: 11px; color: #cfdaec; white-space: nowrap; text-align: right; }
.op-casNum em { color: #7e8ea3; font-style: normal; } .op-casNum s { color: #e5707a; text-decoration: none; margin-left: 4px; }
.op-rStats span { display: block; font-family: 'Space Grotesk', monospace; font-size: 10px; letter-spacing: 2px; color: #7d8ba6; }
.op-rStats b { font-size: 22px; }
.op-rCont { cursor: pointer; width: 100%; font-family: 'Oswald'; font-size: 15px; letter-spacing: 2px; color: #06222b; background: #56b9cf; border: none; padding: 13px;
  clip-path: polygon(0 6px,6px 0,calc(100% - 6px) 0,100% 6px,100% calc(100% - 6px),calc(100% - 6px) 100%,6px 100%,0 calc(100% - 6px)); }

@media (max-width: 560px) { .op-diffs { grid-template-columns: 1fr; } }
`;
