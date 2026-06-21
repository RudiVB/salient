"use client";
import { useMemo, useState, useEffect } from "react";
import { useGame } from "@/lib/store";
import { CATALOG, fmt } from "@/lib/catalog";
import { randMoney } from "@/lib/economy";
import { genFront, armyPower, armyPowerVet, unitPower, Rung } from "@/lib/campaign";
import { terrainFor, TACTICS, casualtyFactor, effectivePower, counterHint, activeSynergies } from "@/lib/combat";
import { heroArmyBonus, heroCasualtyMult } from "@/lib/heroes";
import UnitArt from "@/components/UnitArt";
import BattleScene from "@/components/BattleScene";
import { preloadUnits } from "@/lib/sprites";
import { playSfx } from "@/lib/audio";

/**
 * CampaignFront — climb a front bottom→top: deploy regiments, fight, take the territory.
 * components/CampaignFront.tsx
 * Props: territoryId, territoryName, accent, difficulty(1-3), onWin(id), onExit
 */
type Phase = "ladder" | "deploy" | "battle" | "result";
interface Battle { winChance: number; before: number; rungReward: number; lastRung: boolean; uids: string[]; player: { defId: string; troops: number; vet?: number }[]; enemy: { defId: string; troops: number }[]; }
interface Casualty { uid: string; defId: string; name: string; before: number; lost: number; after: number; }
interface Result { won: boolean; reward: number; moneyLost: number; cleared: boolean; casualties: Casualty[]; totalLost: number; vetGained: number; }
const hashStr = (s: string) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0); };

export default function CampaignFront({
  territoryId, territoryName, accent, difficulty = 2, onWin, onExit,
}: { territoryId: string; territoryName: string; accent: string; difficulty?: number; onWin?: (id: string) => void; onExit?: () => void }) {
  const game = useGame();
  const frontScale = 1 + (game.owned?.length || 0) * 0.12;   // more regions held → tougher, richer fronts
  const rungs = useMemo(() => genFront(territoryId, difficulty, frontScale), [territoryId, difficulty, frontScale]);
  const [pos, setPos] = useState(0);                       // current rung
  const [phase, setPhase] = useState<Phase>("ladder");
  const [picked, setPicked] = useState<Set<string>>(() => new Set(game.collection.filter((u) => u.troops > 0).map((u) => u.uid)));
  const [result, setResult] = useState<Result | null>(null);
  const [battle, setBattle] = useState<Battle | null>(null);

  const terrain = useMemo(() => terrainFor(territoryId), [territoryId]);
  const [tacticId, setTacticId] = useState(TACTICS[0].id);
  const tactic = TACTICS.find((t) => t.id === tacticId) || TACTICS[0];

  useEffect(() => { preloadUnits(); }, []);   // warm unit art before the battle renders

  const rung: Rung | undefined = rungs[pos];
  const live = game.collection.filter((u) => u.troops > 0);
  const deployed = live.filter((u) => picked.has(u.uid));
  const yourPower = armyPowerVet(deployed);
  const enemyPower = rung?.strength || 0;
  const maxP = Math.max(yourPower, enemyPower, 1);

  const toggle = (uid: string) => setPicked((s) => { const n = new Set(s); n.has(uid) ? n.delete(uid) : n.add(uid); return n; });

  const plan = useMemo(() => {
    if (!rung) return null;
    const d = game.doctrine; const hb = heroArmyBonus(deployed);
    const pEff = effectivePower(deployed, rung.enemy, terrain, tactic) * d.powerMult * hb.powerMult;
    const eEff = effectivePower(rung.enemy, deployed, terrain, null);
    return { winChance: Math.round(Math.min(96, Math.max(4, (pEff / (pEff + eEff || 1)) * 100 + d.winChanceAdd + hb.winChanceAdd))) };
  }, [deployed, rung, terrain, tactic, game.doctrine.powerMult, game.doctrine.winChanceAdd]);
  const synergies = useMemo(() => activeSynergies(deployed), [deployed]);

  const launch = () => {
    if (!rung || deployed.length === 0) return;
    setBattle({
      winChance: plan?.winChance ?? 50,
      before: deployed.reduce((s, u) => s + u.troops, 0),
      rungReward: rung.reward,
      lastRung: pos + 1 >= rungs.length,
      uids: deployed.map((u) => u.uid),
      player: deployed.map((u) => ({ defId: u.defId, troops: u.troops, vet: u.vet })),
      enemy: rung.enemy.map((e) => ({ defId: e.defId, troops: e.troops })),
    });
    setPhase("battle");
  };

  // battle animation finished -> the player's ability use (effort) decided the outcome; apply consequences
  const resolveBattle = (won: boolean, effort: number) => {
    if (!battle) return;
    const factor = casualtyFactor(battle.player, battle.enemy, terrain, tactic, won, effort) * game.doctrine.casualtyMult;
    const heroOf = (uid: string) => game.collection.find((u) => u.uid === uid)?.hero;
    // per-regiment losses with deterministic jitter + the regiment's own commander shielding
    const casualties: Casualty[] = battle.player.map((u, i) => {
      const uid = battle.uids[i];
      const j = (hashStr(uid) % 1000) / 1000;                  // 0..1 stable per regiment
      const frac = Math.min(1, factor * (0.75 + j * 0.5) * heroCasualtyMult(heroOf(uid)));
      const lost = Math.round(u.troops * frac);
      return { uid, defId: u.defId, name: CATALOG[u.defId]?.name || u.defId, before: u.troops, lost, after: Math.max(0, u.troops - lost) };
    });
    game.applyLosses(casualties.map((c) => ({ uid: c.uid, after: c.after })));
    const totalLost = casualties.reduce((s, c) => s + c.lost, 0);
    const survivors = casualties.filter((c) => c.after > 0).map((c) => c.uid);
    const wiped = casualties.filter((c) => c.after <= 0).map((c) => c.uid);
    let moneyLost = 0; let reward = 0; let vetGained = 0;
    const cleared = won && battle.lastRung;
    if (won) {
      const sMult = 1 + Math.min(5, game.streak) * 0.08;        // win-streak bonus (up to +40%)
      reward = Math.round(battle.rungReward * sMult);
      game.addMoney(reward);
      game.awardVeterancy(survivors);                          // survivors get tougher
      vetGained = survivors.length;
      setPos((p) => Math.min(rungs.length, p + 1));
    } else {
      moneyLost = Math.round(game.money * 0.12) + 40;           // defeat drains war funds
      game.addMoney(-moneyLost);
    }
    game.progressHeroes(survivors, wiped, won);                 // commanders gain XP / fall
    game.recordBattle(won);                                     // rank + streak + research
    playSfx(won ? "victory" : "defeat");
    setResult({ won, reward, moneyLost, cleared, casualties, totalLost, vetGained });
    setBattle(null);
    setPhase("result");
  };

  const continueAfter = () => {
    if (result?.cleared) { onWin?.(territoryId); onExit?.(); return; }
    setResult(null); setPhase("ladder");
  };

  return (
    <div className="cf" style={{ ["--acc" as any]: accent }}>
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="cf-top">
        <button className="cf-exit" onClick={onExit}>← Withdraw</button>
        <div className="cf-where">
          <div className="cf-kick">FRONT</div>
          <div className="cf-name">{territoryName}</div>
        </div>
        <div className="cf-treasury">{randMoney(game.money)}</div>
      </div>

      {/* LADDER */}
      {phase === "ladder" && (
        <div className="cf-ladder">
          {[...rungs].reverse().map((r) => {
            const state = r.idx < pos ? "done" : r.idx === pos ? "now" : "lock";
            return (
              <div key={r.idx} className={"cf-rung " + state}>
                <div className="cf-rungL">
                  <div className="cf-rungIdx">{r.idx + 1}</div>
                  <div className="cf-line" />
                </div>
                <div className="cf-rungBody">
                  <div className="cf-rungHead">
                    <span className="cf-rungName">{r.name}</span>
                    <span className="cf-rungStr">⚔ {fmt(r.strength)}</span>
                  </div>
                  <div className="cf-enemy">
                    {r.enemy.map((e, i) => <span key={i} className="cf-eu">{CATALOG[e.defId].name} <b>×{fmt(e.troops)}</b></span>)}
                  </div>
                  {state === "now" && <button className="cf-deploy" onClick={() => setPhase("deploy")}>Deploy ▸</button>}
                  {state === "done" && <div className="cf-cleared">✓ Cleared</div>}
                  {state === "lock" && <div className="cf-locked">🔒 Locked</div>}
                </div>
              </div>
            );
          })}
          <div className="cf-base">▼ YOUR LINES ▼</div>
        </div>
      )}

      {/* DEPLOY */}
      {phase === "deploy" && rung && (
        <div className="cf-deployWrap">
          <div className="cf-vs">
            <div className="cf-vsRow">
              <div className="cf-vsSide"><span>YOUR FORCE</span><b style={{ color: accent }}>⚔ {fmt(yourPower)}</b></div>
              <div className="cf-vsSide r"><span>{rung.name}</span><b style={{ color: "#e5414f" }}>⚔ {fmt(enemyPower)}</b></div>
            </div>
            <div className="cf-vsBar">
              <i style={{ width: `${(yourPower / (yourPower + enemyPower || 1)) * 100}%`, background: accent }} />
              <i className="cf-foe" style={{ width: `${(enemyPower / (yourPower + enemyPower || 1)) * 100}%` }} />
            </div>
          </div>

          <div className="cf-plan">
            <div className="cf-planRow">
              <div className="cf-terrain"><span className="cf-pLab">TERRAIN</span><b>{terrain.name}</b><em>{terrain.blurb}</em></div>
              {plan && <div className="cf-odds"><span className="cf-pLab">EST. WIN CHANCE</span><b style={{ color: plan.winChance >= 55 ? "#4fd190" : plan.winChance >= 40 ? "#f0c860" : "#e5414f" }}>{plan.winChance}%</b></div>}
            </div>
            <div className="cf-intel">⚑ {counterHint(rung.enemy)}</div>
            {synergies.length > 0 && <div className="cf-syns">{synergies.map((s, i) => <span key={i} className="cf-syn">{s.label}</span>)}</div>}
            <div className="cf-tactics">
              {TACTICS.map((t) => (
                <button key={t.id} className={"cf-tac" + (t.id === tacticId ? " on" : "")} onClick={() => setTacticId(t.id)}>
                  <b>{t.name}</b><em>{t.desc}</em>
                </button>
              ))}
            </div>
          </div>

          <div className="cf-grpHead">ENEMY FORCE</div>
          <div className="cf-foeGrid">
            {rung.enemy.map((e, i) => {
              const c = CATALOG[e.defId];
              return (
                <div key={i} className="cf-foeCard">
                  <div className="cf-thumb foe"><UnitArt id={e.defId} kind={c.kind} side="E" className="cf-img" /></div>
                  <div className="cf-cName">{c.name}</div>
                  <div className="cf-cNum">×{fmt(e.troops)}</div>
                </div>
              );
            })}
          </div>

          <div className="cf-grpHead">YOUR REGIMENTS <em>tap to deploy</em></div>
          <div className="cf-pickGrid">
            {live.map((u) => {
              const c = CATALOG[u.defId]; const on = picked.has(u.uid);
              return (
                <button key={u.uid} className={"cf-pickCard" + (on ? " on" : "")} style={{ ["--ua" as any]: c.accent }} onClick={() => toggle(u.uid)}>
                  <div className="cf-thumb"><UnitArt id={u.defId} kind={c.kind} side="P" className="cf-img" /></div>
                  <div className="cf-pcMain">
                    <div className="cf-cName">{c.name}{(u.vet || 0) > 0 && <span className="cf-vet">{"★".repeat(u.vet || 0)}</span>}</div>
                    <div className="cf-cSub">{fmt(u.troops)} · ⚔ {fmt(Math.round(unitPower(u.defId, u.troops) * (1 + Math.min(5, u.vet || 0) * 0.12)))}</div>
                  </div>
                  <span className="cf-chk">{on ? "✓" : ""}</span>
                </button>
              );
            })}
          </div>

          <div className="cf-launchBar">
            <button className="cf-back" onClick={() => setPhase("ladder")}>Back</button>
            <div className="cf-deployCount">{deployed.length} deployed</div>
            <button className="cf-launch" disabled={deployed.length === 0} onClick={launch}>⚔ Launch Attack ▸</button>
          </div>
        </div>
      )}

      {/* BATTLE */}
      {phase === "battle" && battle && rung && (
        <BattleScene player={battle.player} enemy={battle.enemy} accent={accent}
          rungName={rung.name} terrainName={terrain.name} terrainId={terrain.id} tacticName={tactic.name}
          winChance={battle.winChance}
          matchup={battle.winChance >= 56 ? "advantage" : battle.winChance <= 44 ? "disadvantage" : "even"}
          onResolve={resolveBattle} />
      )}

      {/* RESULT */}
      {phase === "result" && result && (
        <div className="cf-result">
          <div className={"cf-rCard " + (result.won ? "win" : "loss")}>
            <div className="cf-rKick">{result.won ? "VICTORY" : "REPULSED"}</div>
            <div className="cf-rTitle">{result.cleared ? `${territoryName} has fallen` : result.won ? "Position taken" : "Attack broke down"}</div>

            <div className="cf-rStats">
              <div><span>TOTAL CASUALTIES</span><b style={{ color: "#e5414f" }}>−{fmt(result.totalLost)}</b></div>
              {result.won
                ? <div><span>REWARD</span><b style={{ color: "#f0c860" }}>+{randMoney(result.reward)}</b></div>
                : <div><span>LOST FUNDS</span><b style={{ color: "#e5414f" }}>−{randMoney(result.moneyLost)}</b></div>}
              {result.won && result.vetGained > 0 && <div><span>VETERANS</span><b style={{ color: "#4fd190" }}>★ {result.vetGained}</b></div>}
            </div>

            {/* per-regiment casualty report */}
            <div className="cf-cas">
              <div className="cf-casHead">CASUALTY REPORT</div>
              {result.casualties.map((c) => {
                const pct = c.before > 0 ? c.after / c.before : 0;
                const wiped = c.after <= 0;
                return (
                  <div key={c.uid} className="cf-casRow">
                    <div className="cf-casName">{c.name}{wiped && <span className="cf-wiped">WIPED OUT</span>}</div>
                    <div className="cf-casBar"><i style={{ width: `${pct * 100}%` }} /></div>
                    <div className="cf-casNum">{fmt(c.after)}<em>/{fmt(c.before)}</em> <s>−{fmt(c.lost)}</s></div>
                  </div>
                );
              })}
            </div>

            {result.won && result.vetGained > 0 && <div className="cf-rNote ok">Surviving regiments gained ★ veterancy — they hit harder next time.</div>}
            {!result.won && <div className="cf-rNote">You lost ground and war funds. Reinforce in the Barracks and try again.</div>}
            <button className="cf-cont" onClick={continueAfter}>
              {result.cleared ? "Claim territory ▸" : result.won ? "Advance ▸" : "Fall back"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const CSS = `
.cf { position: fixed; inset: 0; z-index: 40; overflow-y: auto; color: #e9eef7;
  font-family: 'Oswald', system-ui, sans-serif;
  background: radial-gradient(120% 90% at 50% 0%, #1a1320 0%, #0b0e16 60%, #07090f 100%);
  --fill: #11151f;
  --cham: polygon(0 8px, 8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px));
  --chamS: polygon(0 4px, 4px 0, calc(100% - 4px) 0, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0 calc(100% - 4px)); }

.cf-top { display: flex; align-items: center; gap: 12px; padding: 16px 18px; position: sticky; top: 0; z-index: 5;
  background: linear-gradient(180deg, rgba(7,9,15,.95), rgba(7,9,15,.4)); }
.cf-exit { cursor: pointer; font-family: 'Space Grotesk', monospace; font-size: 12px; letter-spacing: 1px; color: #aebbd2;
  background: var(--fill); clip-path: var(--chamS); padding: 8px 14px; border: none; }
.cf-exit:hover { color: #fff; }
.cf-where { flex: 1; text-align: center; }
.cf-kick { font-family: 'Space Grotesk', monospace; font-size: 10px; letter-spacing: 4px; color: #e5414f; }
.cf-name { font-size: 18px; font-weight: 700; letter-spacing: 1px; }
.cf-treasury { font-family: 'Space Grotesk', monospace; color: #f0c860; font-size: 14px; }

/* ladder */
.cf-ladder { max-width: 640px; margin: 0 auto; padding: 10px 18px 50px; }
.cf-rung { display: flex; gap: 14px; }
.cf-rungL { display: flex; flex-direction: column; align-items: center; width: 36px; }
.cf-rungIdx { width: 34px; height: 34px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  font-weight: 700; font-size: 15px; clip-path: polygon(50% 0, 100% 25%, 100% 75%, 50% 100%, 0 75%, 0 25%);
  background: #25303f; color: #8da0bf; }
.cf-line { flex: 1; width: 2px; background: rgba(150,180,225,.18); margin: 4px 0; }
.cf-rung:last-of-type .cf-line { display: none; }
.cf-rungBody { flex: 1; background: var(--fill); clip-path: var(--cham); padding: 14px 16px; margin-bottom: 12px; border-left: 2px solid transparent; }
.cf-rung.now .cf-rungIdx { background: var(--acc); color: #06222b; box-shadow: 0 0 16px -2px var(--acc); }
.cf-rung.now .cf-rungBody { background: #16202e; outline: 1px solid var(--acc); }
.cf-rung.done .cf-rungIdx { background: #2f5e44; color: #cfe8d8; }
.cf-rung.lock { opacity: .5; }
.cf-rungHead { display: flex; justify-content: space-between; align-items: center; }
.cf-rungName { font-size: 16px; font-weight: 600; letter-spacing: .5px; }
.cf-rungStr { font-family: 'Space Grotesk', monospace; font-size: 12px; color: #e5414f; }
.cf-enemy { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
.cf-eu { font-size: 11px; color: #9fb0cc; background: rgba(229,65,79,.1); clip-path: var(--chamS); padding: 3px 9px; }
.cf-eu b { color: #e9eef7; font-weight: 600; }
.cf-deploy { margin-top: 12px; cursor: pointer; font-family: 'Oswald'; font-weight: 700; font-size: 14px; letter-spacing: 1px;
  color: #06222b; background: linear-gradient(180deg, #74cee0, #3f9fb8); border: none; clip-path: var(--cham); padding: 10px 18px; }
.cf-cleared { margin-top: 10px; color: #4fd190; font-size: 13px; font-family: 'Space Grotesk', monospace; }
.cf-locked { margin-top: 10px; color: #6b7a98; font-size: 13px; font-family: 'Space Grotesk', monospace; }
.cf-base { text-align: center; color: #6b7a98; font-family: 'Space Grotesk', monospace; font-size: 11px; letter-spacing: 3px; margin-top: 6px; }

/* deploy */
.cf-deployWrap { max-width: 760px; margin: 0 auto; padding: 12px 18px 96px; }
.cf-vs { background: var(--fill); clip-path: var(--cham); padding: 14px 16px; margin-bottom: 18px; }
.cf-vsRow { display: flex; justify-content: space-between; gap: 12px; margin-bottom: 9px; }
.cf-vsSide span { color: #93a2bd; font-family: 'Space Grotesk', monospace; letter-spacing: 1px; font-size: 11px; }
.cf-vsSide b { display: block; font-family: 'Space Grotesk', monospace; font-size: 17px; margin-top: 2px; }
.cf-vsSide.r { text-align: right; }
.cf-vsBar { position: relative; height: 14px; background: rgba(150,180,225,.1); display: flex; clip-path: var(--chamS); }
.cf-vsBar i { height: 100%; transition: width .35s; }
.cf-vsBar .cf-foe { background: #e5414f; margin-left: auto; opacity: .85; }

.cf-grpHead { font-family: 'Space Grotesk', monospace; font-size: 11px; letter-spacing: 3px; color: #93a2bd; margin: 0 0 10px; }
.cf-grpHead em { font-style: normal; color: #6b7a98; letter-spacing: 1px; margin-left: 6px; text-transform: none; }

.cf-img { width: 100%; height: 100%; object-fit: contain; display: block; filter: drop-shadow(0 5px 6px rgba(0,0,0,.5)); }
.cf-thumb { width: 56px; height: 70px; flex-shrink: 0; clip-path: var(--chamS); overflow: hidden; padding: 3px;
  background: radial-gradient(70% 60% at 50% 40%, color-mix(in srgb, var(--ua, #56b9cf) 24%, transparent), transparent 72%), #0b121c; }
.cf-thumb.foe { background: radial-gradient(70% 60% at 50% 40%, rgba(229,65,79,.22), transparent 72%), #0b121c; }

.cf-foeGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(98px, 1fr)); gap: 8px; margin-bottom: 22px; }
.cf-foeCard { background: var(--fill); clip-path: var(--cham); padding: 8px; text-align: center; border-top: 2px solid rgba(229,65,79,.55); }
.cf-foeCard .cf-thumb { width: 100%; height: 62px; margin: 0 auto 6px; }
.cf-cName { font-size: 13px; font-weight: 600; line-height: 1.15; }
.cf-cNum { font-family: 'Space Grotesk', monospace; font-size: 12px; color: #e5777f; margin-top: 2px; }

.cf-pickGrid { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 8px; }
.cf-pickCard { position: relative; display: flex; align-items: center; gap: 10px; cursor: pointer; text-align: left; color: #e9eef7;
  background: var(--fill); clip-path: var(--cham); padding: 8px 10px; border: none; transition: filter .12s; }
.cf-pickCard:hover { filter: brightness(1.08); }
.cf-vet { color: #f0c860; font-size: 11px; letter-spacing: 1px; margin-left: 7px; vertical-align: middle; }
.cf-plan { background: linear-gradient(180deg, rgba(18,26,40,.8), rgba(11,17,27,.85)); border: 1px solid rgba(120,150,190,.16);
  padding: 14px 16px; margin: 4px 0 16px;
  clip-path: polygon(0 8px,8px 0,calc(100% - 8px) 0,100% 8px,100% calc(100% - 8px),calc(100% - 8px) 100%,8px 100%,0 calc(100% - 8px)); }
.cf-planRow { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.cf-pLab { display: block; font-family: 'Space Grotesk', monospace; font-size: 10px; letter-spacing: 2px; color: #7d8ba6; margin-bottom: 3px; }
.cf-terrain b { font-size: 17px; letter-spacing: 1px; } .cf-terrain em { display: block; color: #93a2bd; font-size: 12px; font-style: normal; margin-top: 2px; }
.cf-odds { text-align: right; } .cf-odds b { font-size: 26px; font-family: 'Space Grotesk', monospace; }
.cf-intel { margin-top: 10px; font-size: 13px; color: #cfd9ea; }
.cf-syns { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 9px; }
.cf-syn { font-family: 'Space Grotesk', monospace; font-size: 10px; letter-spacing: 1px; color: #4fd190;
  border: 1px solid rgba(79,209,144,.35); background: rgba(79,209,144,.08); padding: 4px 8px; border-radius: 99px; }
.cf-tactics { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 7px; margin-top: 12px; }
.cf-tac { text-align: left; cursor: pointer; background: rgba(20,30,46,.6); border: 1px solid rgba(120,150,190,.18); padding: 9px 11px; color: #c8d4ea;
  clip-path: polygon(0 5px,5px 0,calc(100% - 5px) 0,100% 5px,100% calc(100% - 5px),calc(100% - 5px) 100%,5px 100%,0 calc(100% - 5px)); transition: border-color .15s; }
.cf-tac:hover { border-color: rgba(120,150,190,.5); }
.cf-tac.on { border-color: #56b9cf; background: rgba(86,185,207,.14); }
.cf-tac b { display: block; font-size: 14px; letter-spacing: .5px; } .cf-tac em { font-style: normal; font-size: 11px; color: #93a2bd; }
.cf-pickCard.on { background: var(--ua); }
.cf-pickCard.on::before { content: ""; position: absolute; inset: 2px; background: #13202c; clip-path: var(--cham); z-index: 0; }
.cf-pickCard > * { position: relative; z-index: 1; }
.cf-pcMain { flex: 1; min-width: 0; }
.cf-cSub { font-family: 'Space Grotesk', monospace; font-size: 11px; color: #8da0bf; margin-top: 3px; }
.cf-chk { width: 24px; height: 24px; flex-shrink: 0; display: flex; align-items: center; justify-content: center; font-weight: 700;
  clip-path: polygon(50% 0,100% 50%,50% 100%,0 50%); background: rgba(150,180,225,.12); color: transparent; }
.cf-pickCard.on .cf-chk { background: var(--ua); color: #06222b; }

.cf-launchBar { position: fixed; left: 0; right: 0; bottom: 0; z-index: 6; display: flex; align-items: center; gap: 10px;
  padding: 14px 18px; background: linear-gradient(180deg, rgba(7,9,15,.15), rgba(7,9,15,.97)); }
.cf-deployCount { font-family: 'Space Grotesk', monospace; font-size: 12px; color: #8da0bf; }
.cf-back { cursor: pointer; font-family: 'Oswald'; font-size: 14px; color: #aebbd2; background: var(--fill); clip-path: var(--cham); border: none; padding: 13px 18px; }
.cf-launch { flex: 1; cursor: pointer; font-family: 'Oswald'; font-weight: 700; font-size: 16px; letter-spacing: 1px; color: #fff;
  background: linear-gradient(180deg, #ff7a7a, #e5414f); border: none; clip-path: var(--cham); padding: 14px; }
.cf-launch:disabled { filter: grayscale(.7) brightness(.6); cursor: default; }

/* result */
.cf-result { position: fixed; inset: 0; z-index: 6; display: flex; align-items: center; justify-content: center; padding: 20px;
  background: rgba(5,7,12,.72); animation: cfFade .3s ease; }
@keyframes cfFade { 0% { opacity: 0; } 100% { opacity: 1; } }
.cf-rCard { position: relative; width: min(420px, 100%); background: var(--fill); clip-path: var(--cham); padding: 28px; text-align: center;
  border-top: 3px solid; }
.cf-rCard.win { border-color: #4fd190; }
.cf-rCard.loss { border-color: #e5414f; }
.cf-rKick { font-family: 'Space Grotesk', monospace; letter-spacing: 5px; font-size: 13px; }
.cf-rCard.win .cf-rKick { color: #4fd190; }
.cf-rCard.loss .cf-rKick { color: #e5414f; }
.cf-rTitle { font-size: 24px; font-weight: 700; letter-spacing: 1px; margin: 8px 0 16px; }
.cf-rStats { display: flex; gap: 12px; justify-content: center; margin-bottom: 16px; }
.cf-rStats div { background: rgba(0,0,0,.25); clip-path: var(--chamS); padding: 10px 18px; }
.cf-rStats span { display: block; font-size: 9px; letter-spacing: 2px; color: #8194b4; font-family: 'Space Grotesk', monospace; }
.cf-rStats b { font-size: 18px; font-family: 'Space Grotesk', monospace; }
.cf-rNote { font-size: 12px; color: #9fb0cc; margin-bottom: 14px; }
.cf-rNote.ok { color: #8fdcb4; }
.cf-cas { background: rgba(0,0,0,.22); border: 1px solid rgba(120,150,190,.16); border-radius: 8px; padding: 11px 13px; margin-bottom: 14px; text-align: left; }
.cf-casHead { font-family: 'Space Grotesk', monospace; font-size: 10px; letter-spacing: 2px; color: #8194b4; margin-bottom: 9px; }
.cf-casRow { display: grid; grid-template-columns: 1fr 90px auto; align-items: center; gap: 10px; margin-bottom: 7px; }
.cf-casName { font-family: 'Space Grotesk', sans-serif; font-size: 12.5px; color: #d6e0ef; display: flex; align-items: center; gap: 7px; min-width: 0; }
.cf-wiped { font-family: 'Oswald'; font-size: 9px; letter-spacing: 1px; color: #fff; background: #b3242f; padding: 1px 5px; border-radius: 3px; white-space: nowrap; }
.cf-casBar { height: 8px; background: rgba(229,65,79,.4); border-radius: 4px; overflow: hidden; }
.cf-casBar i { display: block; height: 100%; background: linear-gradient(90deg,#4fd190,#7fe0ad); border-radius: 4px; }
.cf-casNum { font-family: 'Space Grotesk', monospace; font-size: 11px; color: #cfdaec; white-space: nowrap; text-align: right; }
.cf-casNum em { color: #7e8ea3; font-style: normal; } .cf-casNum s { color: #e5707a; text-decoration: none; margin-left: 4px; }
.cf-cont { cursor: pointer; font-family: 'Oswald'; font-weight: 700; font-size: 16px; letter-spacing: 1px; width: 100%;
  color: #06222b; background: linear-gradient(180deg, #74cee0, #3f9fb8); border: none; clip-path: var(--cham); padding: 13px; }
`;
