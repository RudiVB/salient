"use client";
import { useMemo, useState, useEffect, useRef } from "react";
import WorldGlobe from "@/components/WorldGlobe";
import { Flag } from "@/components/Flag";
import CampaignFront from "@/components/CampaignFront";
import { useGame } from "@/lib/store";
import { NATION } from "@/lib/nations";
import { TERRITORY, TERRITORIES, Owner } from "@/lib/world";
import { AI_FACTIONS, PLAYER_FACTION, factionName, factionColor, colorMapOf, attackableSet, territoryCounts, worldOutcome, DOMINATION } from "@/lib/worldsim";

/**
 * WorldMap — Risk-style globe campaign. components/WorldMap.tsx
 * Props: onBack (-> menu), onArmy (-> barracks/game shell)
 */
export default function WorldMap({ onBack, onArmy }: { onBack?: () => void; onArmy?: () => void }) {
  const game = useGame();
  const nat = (game.nation && NATION[game.nation]) || null;
  const accent = nat?.accent || "#56b9cf";

  const [sel, setSel] = useState<string | null>(null);
  const [fighting, setFighting] = useState<string | null>(null);

  const world = game.world;
  const own = useMemo<Record<string, Owner>>(() => {
    const o: Record<string, Owner> = {};
    for (const t of TERRITORIES) o[t.id] = world.owner[t.id] === PLAYER_FACTION ? "player" : "enemy";
    return o;
  }, [world]);
  const colorMap = useMemo(() => colorMapOf(world, accent), [world, accent]);
  const attackable = useMemo(() => attackableSet(world), [world]);
  const counts = useMemo(() => {
    const c = territoryCounts(world); const p = c[PLAYER_FACTION] || 0; const total = TERRITORIES.length; return { p, e: total - p, total };
  }, [world]);
  const standings = useMemo(() => {
    const c = territoryCounts(world);
    const rows = [{ id: PLAYER_FACTION, name: nat?.name || "Your Empire", color: accent, n: c[PLAYER_FACTION] || 0 },
      ...AI_FACTIONS.map((f) => ({ id: f.id, name: f.name, color: f.color, n: c[f.id] || 0 }))];
    return rows.filter((r) => r.n > 0).sort((a, b) => b.n - a.n);
  }, [world, accent, nat]);
  const won = counts.p === counts.total;
  const outcome = useMemo(() => worldOutcome(world), [world]);
  const target = Math.ceil(counts.total * DOMINATION);

  // ---- the war runs itself: auto-advance turns while watching the map ----
  const [paused, setPaused] = useState(false);
  const TURN_MS = 8500;
  const tickRef = useRef(game.worldTick); tickRef.current = game.worldTick;
  useEffect(() => {
    if (fighting || paused || outcome) return;        // hold during battles / once decided
    const iv = setInterval(() => tickRef.current(), TURN_MS);
    return () => clearInterval(iv);
  }, [fighting, paused, outcome]);

  const selT = sel ? TERRITORY[sel] : null;
  const selOwner = sel ? world.owner[sel] : null;
  const selGarrison = sel ? world.garrison[sel] || 0 : 0;
  const canAttack = !!sel && attackable.has(sel);

  const attack = () => { if (!sel || !attackable.has(sel)) return; setFighting(sel); };
  const captureFront = (id: string) => {
    game.captureTerritory(id);
    game.addMoney(120);
    game.worldTick();                                 // taking ground triggers the world to react
    setSel(id);
  };

  return (
    <div className="wm">
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: CSS }} />

      <WorldGlobe accent={accent} ownership={own} selectedId={sel} attackable={attackable} onSelect={setSel} colorMap={colorMap} />

      {/* top HUD */}
      <div className="wm-top">
        <div className="wm-nation">
          {nat && <Flag id={nat.id} className="wm-flag" />}
          <div>
            <div className="wm-natName">{nat?.name || "Commander"}</div>
            <div className="wm-natSub">{nat ? nat.perkTitle : "Take the world"}</div>
          </div>
        </div>
        <div className="wm-stats">
          <div className="wm-stat"><span>SUPPLIES</span><b style={{ color: "#f0c860" }}>◆ {game.supplies}</b></div>
          <div className="wm-stat"><span>TERRITORY</span><b style={{ color: accent }}>{counts.p}</b><i>/ {counts.total}</i></div>
        </div>
        <div className="wm-actions">
          <button className={"wm-chip wm-live" + (paused ? " paused" : "")} onClick={() => setPaused((p) => !p)}>
            <span className="wm-liveDot" /> {paused ? "Paused" : "Live"} · Turn {world.tick}
          </button>
          {onArmy && <button className="wm-chip" onClick={onArmy}>⚔ Barracks</button>}
          {onBack && <button className="wm-chip" onClick={onBack}>☰ Menu</button>}
        </div>
      </div>

      {/* faction standings */}
      <div className="wm-standings">
        {standings.map((s) => (
          <div key={s.id} className={"wm-fac" + (s.id === PLAYER_FACTION ? " me" : "")}>
            <span className="wm-facDot" style={{ background: s.color }} />
            <span className="wm-facName">{s.id === PLAYER_FACTION ? "You" : s.name}</span>
            <b>{s.n}</b>
          </div>
        ))}
      </div>

      {/* conquest progress */}
      <div className="wm-progress">
        <div className="wm-progFill" style={{ width: `${Math.min(100, (counts.p / target) * 100)}%`, background: accent }} />
        <span>DOMINATION · {counts.p} / {target} regions</span>
      </div>

      {/* selected territory panel */}
      {selT && (
        <div className="wm-panel" style={{ ["--acc" as any]: accent }}>
          <div className="wm-pInner">
            <div className="wm-pHead">
              <div className="wm-pName">{selT.name}</div>
              <span className="wm-owner" style={{ color: selOwner === PLAYER_FACTION ? "#4fd190" : factionColor(selOwner || "") }}>
                ● {selOwner === PLAYER_FACTION ? "Held" : factionName(selOwner || "", nat?.name || "Enemy")}
              </span>
            </div>
            <div className="wm-pStats">
              <span>🛡 Garrison <b>{selGarrison}</b></span>
              <span>Borders {selT.neighbors.length}</span>
            </div>
            {selOwner === PLAYER_FACTION ? (
              <>
                <div className="wm-pNote">Your territory — your standing army adds <b style={{ color: "#4fd190" }}>+{game.playerDefense}</b> defence here. Fortify it before the AI strikes.</div>
                <button className="wm-fortify" disabled={game.supplies < 12 || selGarrison >= 14} onClick={() => game.reinforceGarrison(sel!)}>
                  {selGarrison >= 14 ? "Garrison at maximum" : game.supplies < 12 ? "Need ◆ 12 supplies" : "🛡 Fortify +1 garrison · ◆ 12"}
                </button>
              </>
            ) : canAttack ? (
              <button className="wm-attack" onClick={attack}>⚔ Attack {selT.name} ▸</button>
            ) : (
              <div className="wm-pNote dim">Out of reach — capture a bordering region first.</div>
            )}
          </div>
        </div>
      )}

      {/* recent world events */}
      {!sel && world.log.length > 0 && (
        <div className="wm-log">
          {world.log.slice(0, 4).map((l, i) => <div key={i} className={"wm-logRow" + (i === 0 ? " new" : "")}>{l}</div>)}
        </div>
      )}

      {!sel && world.log.length === 0 && <div className="wm-hint">The war moves on its own · drag to spin · tap a glowing region to attack</div>}

      {fighting && (
        <CampaignFront
          territoryId={fighting}
          territoryName={TERRITORY[fighting].name}
          accent={accent}
          difficulty={2}
          onWin={captureFront}
          onExit={() => setFighting(null)}
        />
      )}

      {/* victory / defeat */}
      {(outcome || won) && (
        <div className="wm-win">
          <div className="wm-winCard" style={{ ["--acc" as any]: (outcome === "defeat") ? "#e5414f" : accent }}>
            <div className="wm-winInner">
              <div className="wm-winKick">1916</div>
              {outcome === "defeat" ? (
                <>
                  <div className="wm-winTitle">YOUR EMPIRE HAS FALLEN</div>
                  <div className="wm-winSub">Every region has been lost. The war is over for {nat?.name || "your nation"}.</div>
                </>
              ) : (
                <>
                  <div className="wm-winTitle">{won ? "THE WORLD IS YOURS" : "DOMINATION ACHIEVED"}</div>
                  <div className="wm-winSub">{nat?.name || "Your empire"} commands {counts.p} of {counts.total} regions — the great powers bow.</div>
                </>
              )}
              {onBack && <button className="wm-attack" style={{ marginTop: 14 }} onClick={onBack}>Return to HQ ▸</button>}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const CSS = `
.wm { position: fixed; inset: 0; z-index: 25; overflow: hidden; color: #e9eef7;
  font-family: 'Oswald', system-ui, sans-serif;
  background: radial-gradient(120% 100% at 50% 30%, #0d1726 0%, #070b12 70%);
  --fill: #0e1826;
  --cham: polygon(0 8px, 8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px));
  --chamS: polygon(0 4px, 4px 0, calc(100% - 4px) 0, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0 calc(100% - 4px)); }

.wm-top { position: absolute; top: 0; left: 0; right: 0; z-index: 3; display: flex; align-items: center; gap: 14px;
  padding: 14px 18px; background: linear-gradient(180deg, rgba(7,11,18,.85), transparent); }
.wm-nation { display: flex; align-items: center; gap: 10px; }
.wm-flag { width: 40px; height: 27px; clip-path: var(--chamS); box-shadow: 0 2px 6px rgba(0,0,0,.6); }
.wm-natName { font-size: 16px; font-weight: 600; letter-spacing: .5px; }
.wm-natSub { font-size: 11px; color: #93a2bd; font-family: 'Space Grotesk', monospace; letter-spacing: 1px; }
.wm-stats { display: flex; gap: 10px; margin-left: auto; }
.wm-stat { background: var(--fill); clip-path: var(--chamS); padding: 7px 12px; text-align: center; }
.wm-stat span { display: block; font-size: 9px; letter-spacing: 2px; color: #8194b4; font-family: 'Space Grotesk', monospace; }
.wm-stat b { font-size: 16px; }
.wm-stat i { font-size: 11px; color: #6b7a98; font-style: normal; }
.wm-actions { display: flex; gap: 8px; }
.wm-chip { cursor: pointer; font-family: 'Space Grotesk', monospace; font-size: 11px; letter-spacing: 1px; color: #aebbd2;
  background: var(--fill); clip-path: var(--chamS); padding: 8px 12px; border: none; }
.wm-chip:hover { color: #fff; background: #16243a; }

.wm-progress { position: absolute; top: 70px; left: 18px; right: 18px; z-index: 3; height: 18px;
  background: rgba(140,175,215,.1); clip-path: var(--chamS); display: flex; align-items: center; }
.wm-progFill { position: absolute; left: 0; top: 0; bottom: 0; transition: width .4s ease; opacity: .85; }
.wm-progress span { position: relative; z-index: 1; margin: 0 auto; font-family: 'Space Grotesk', monospace;
  font-size: 9.5px; letter-spacing: 2px; color: #cfe0ea; }

.wm-panel { position: absolute; bottom: 0; left: 0; right: 0; z-index: 3; padding: 16px;
  display: flex; justify-content: center; animation: wmUp .25s ease; }
@keyframes wmUp { 0% { transform: translateY(30px); opacity: 0; } 100% { transform: translateY(0); opacity: 1; } }
.wm-pInner { position: relative; width: min(560px, 100%); background: var(--acc); clip-path: var(--cham); padding: 16px 18px; }
.wm-pInner::before { content: ""; position: absolute; inset: 2px; background: #0e1826; clip-path: var(--cham); z-index: 0; }
.wm-pInner > * { position: relative; z-index: 1; }
.wm-pHead { display: flex; align-items: center; gap: 10px; }
.wm-pName { font-size: 19px; font-weight: 700; letter-spacing: 1px; flex: 1; }
.wm-owner { font-family: 'Space Grotesk', monospace; font-size: 11px; letter-spacing: 1px; padding: 3px 10px; clip-path: var(--chamS); }
.wm-owner.mine { color: #4fd190; background: rgba(79,209,144,.12); }
.wm-owner.foe { color: #e5414f; background: rgba(229,65,79,.12); }
.wm-pBorders { font-size: 11.5px; color: #8da0bf; font-family: 'Space Grotesk', monospace; margin: 8px 0; line-height: 1.5; }
.wm-pNote { font-size: 13px; color: #aebbd2; font-weight: 300; }
.wm-pNote.dim { color: #6b7a98; }
.wm-attack { cursor: pointer; font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 15px; letter-spacing: 1px;
  color: #06222b; padding: 12px 18px; border: none; clip-path: var(--cham); width: 100%; margin-top: 6px;
  background: linear-gradient(180deg, #ff7a7a, #e5414f); }
.wm-attack:hover { filter: brightness(1.1); }

.wm-standings { position: absolute; top: 96px; left: 18px; right: 18px; z-index: 3; display: flex; gap: 6px; flex-wrap: wrap; }
.wm-fac { display: flex; align-items: center; gap: 6px; background: rgba(8,14,22,.72); clip-path: var(--chamS); padding: 5px 10px; }
.wm-fac.me { box-shadow: inset 0 0 0 1px rgba(255,255,255,.45); }
.wm-facDot { width: 10px; height: 10px; border-radius: 2px; box-shadow: 0 0 6px currentColor; }
.wm-facName { font-family: 'Space Grotesk', monospace; font-size: 11px; color: #cfe0ea; }
.wm-fac b { font-family: 'Oswald'; font-size: 14px; color: #fff; }
.wm-live { display: flex; align-items: center; gap: 7px; color: #cdeede !important; background: #11324a !important; }
.wm-live:hover { background: #18486a !important; }
.wm-live.paused { color: #d9c08a !important; background: #3a2f12 !important; }
.wm-liveDot { width: 8px; height: 8px; border-radius: 50%; background: #4fd190; box-shadow: 0 0 6px #4fd190; animation: wmPulse 1.6s ease-in-out infinite; }
.wm-live.paused .wm-liveDot { background: #f0c860; box-shadow: none; animation: none; }
@keyframes wmPulse { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: .35; transform: scale(.7); } }
.wm-pStats { display: flex; gap: 18px; font-family: 'Space Grotesk', monospace; font-size: 12px; color: #9fb0cc; margin: 8px 0; }
.wm-pStats b { color: #fff; }
.wm-log { position: absolute; bottom: 16px; left: 18px; right: 18px; z-index: 3; display: flex; flex-direction: column; gap: 3px; pointer-events: none; align-items: flex-start; }
.wm-logRow { font-family: 'Space Grotesk', monospace; font-size: 10.5px; color: #8aa0bd; background: rgba(7,11,18,.55); padding: 4px 9px; clip-path: var(--chamS); max-width: 100%; }
.wm-logRow.new { color: #fff; background: rgba(20,40,58,.7); }

.wm-fortify { cursor: pointer; font-family: 'Oswald', sans-serif; font-weight: 600; font-size: 14px; letter-spacing: .5px; color: #06222b; padding: 11px 16px; border: none; clip-path: var(--cham); width: 100%; margin-top: 8px; background: linear-gradient(180deg, #7fe0ad, #4fd190); }
.wm-fortify:hover:not(:disabled) { filter: brightness(1.08); }
.wm-fortify:disabled { background: rgba(120,140,165,.2); color: #7e8ea3; cursor: not-allowed; }

.wm-hint { position: absolute; bottom: 20px; left: 0; right: 0; z-index: 3; text-align: center;
  font-family: 'Space Grotesk', monospace; font-size: 11px; letter-spacing: 1px; color: #6b7a98; }

.wm-win { position: absolute; inset: 0; z-index: 5; display: flex; align-items: center; justify-content: center;
  background: rgba(4,8,14,.7); animation: wmFade .4s ease; padding: 20px; }
@keyframes wmFade { 0% { opacity: 0; } 100% { opacity: 1; } }
.wm-winCard { position: relative; width: min(440px, 100%); background: var(--acc); clip-path: var(--cham); padding: 30px; text-align: center; }
.wm-winCard::before { content: ""; position: absolute; inset: 2px; background: #0e1826; clip-path: var(--cham); z-index: 0; }
.wm-winInner { position: relative; z-index: 1; }
.wm-winKick { font-family: 'Space Grotesk', monospace; letter-spacing: 6px; color: #f0c860; font-size: 13px; }
.wm-winTitle { font-size: 32px; font-weight: 700; letter-spacing: 3px; margin: 10px 0; }
.wm-winSub { color: #aebbd2; font-size: 14px; font-weight: 300; }

@media (max-width: 640px) {
  .wm-top { flex-wrap: wrap; gap: 10px; }
  .wm-natName { font-size: 14px; }
  .wm-stats { margin-left: 0; }
  .wm-actions { margin-left: auto; }
}
`;
