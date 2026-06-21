"use client";
import { useEffect, useState } from "react";
import { Flag } from "@/components/Flag";
import HomelandScene from "@/components/HomelandScene";
import { useGame } from "@/lib/store";
import { NATION } from "@/lib/nations";
import { fmt } from "@/lib/catalog";
import { BUILDINGS, BMAP, buildingOutput, randMoney, randShort } from "@/lib/economy";

/**
 * HomelandScreen — build a town on an interactive 3D island.
 * components/HomelandScreen.tsx · tap an empty plot to choose a building,
 * tap a built plot to upgrade or demolish it. Multiple of each type allowed.
 */
export default function HomelandScreen({ onBack }: { onBack?: () => void }) {
  const game = useGame();
  const nat = (game.nation && NATION[game.nation]) || null;
  const accent = nat?.accent || "#56b9cf";
  const plots = game.plots || [];
  const [sel, setSel] = useState<number | null>(null);

  useEffect(() => {
    game.tickIncome();
    const t = setInterval(() => game.tickIncome(), 60000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const outText = (id: string, lvl: number) => {
    const def = BMAP[id]; const out = buildingOutput(def, lvl);
    if (def.kind === "farm") return `${out} food/mo`;
    if (def.kind === "infra") return `+${out}% income`;
    if (def.kind === "barracks") return `+${out} supplies/mo`;
    return `${randMoney(out)}/mo`;
  };

  const plot = sel != null ? plots[sel] : null;
  const built = !!(plot && plot.type);
  const def = built ? BMAP[plot!.type!] : null;
  const lvl = plot?.level || 0;
  const max = def ? lvl >= def.max : false;
  const upCost = sel != null ? game.upgradeCost(sel) : 0;

  return (
    <div className="hl" style={{ ["--acc" as any]: accent }}>
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="hl-top">
        <button className="hl-back" onClick={onBack}>← HQ</button>
        <div className="hl-where">
          {nat && <Flag id={nat.id} className="hl-flag" />}
          <div className="hl-titles">
            <div className="hl-kick">HOME FRONT · 1916</div>
            <div className="hl-name">{nat?.name || "The Homeland"}</div>
          </div>
        </div>
      </div>

      <div className="hl-chips">
        <div className="hl-chip"><span>TREASURY</span><b style={{ color: "#f0c860" }}>{randMoney(Math.floor(game.money))}</b></div>
        <div className="hl-chip"><span>NET/MO</span><b style={{ color: game.incomePerHour >= 0 ? "#4fd190" : "#e5414f" }}>{game.incomePerHour >= 0 ? "+" : ""}{randShort(game.incomePerHour)}</b></div>
        <div className="hl-chip"><span>FOOD</span><b style={{ color: game.starving ? "#e5414f" : "#4fd190" }}>{game.econ.food}/{game.foodNeed}</b></div>
        <div className="hl-chip"><span>POP</span><b style={{ color: "#cfe0ea" }}>{game.population}M</b></div>
      </div>

      {game.starving && <div className="hl-warn">⚠ Your people are starving — the economy runs at half output. Build more <b>State Farmland</b>.</div>}

      <div className="hl-stage">
        <HomelandScene plots={plots} selected={sel} accent={accent} nation={game.nation} onSelect={setSel} />
        {sel == null && <div className="hl-hint">Tap a plot to build · drag to scroll · pinch / scroll to zoom</div>}
      </div>

      {/* empty plot → choose a building */}
      {sel != null && !built && (
        <div className="hl-sheet">
          <button className="hl-sheetX" onClick={() => setSel(null)}>✕</button>
          <div className="hl-pickHead">EMPTY PLOT · choose a building</div>
          <div className="hl-pick">
            {BUILDINGS.map((b) => {
              const cost = game.newBuildCost(b.id); const afford = game.money >= cost;
              return (
                <button key={b.id} className={"hl-pickCard" + (afford ? "" : " poor")} disabled={!afford} onClick={() => game.buildPlot(sel, b.id)}>
                  <span className="hl-pickIcon">{b.icon}</span>
                  <span className="hl-pickName">{b.name}</span>
                  <span className="hl-pickOut">{outText(b.id, 1)}</span>
                  <span className={"hl-pickCost" + (afford ? "" : " no")}>{randShort(cost)}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* built plot → upgrade / demolish */}
      {sel != null && built && def && (
        <div className="hl-sheet">
          <button className="hl-sheetX" onClick={() => setSel(null)}>✕</button>
          <div className="hl-sheetTop">
            <span className="hl-sheetIcon">{def.icon}</span>
            <div className="hl-sheetName">
              <b>{def.name}</b>
              <div className="hl-pips">{Array.from({ length: def.max }, (_, i) => <i key={i} className={i < lvl ? "on" : ""} />)}</div>
            </div>
            <span className="hl-sheetLvl">LV {lvl}</span>
          </div>
          <div className="hl-sheetOut">
            <span>Now: <b>{outText(def.id, lvl)}</b></span>
            {!max && <span className="hl-next">→ Lv{lvl + 1}: <b>{outText(def.id, lvl + 1)}</b></span>}
          </div>
          <div className="hl-actions">
            <button className={"hl-build" + (max ? " max" : game.money >= upCost ? "" : " poor")} disabled={max || game.money < upCost} onClick={() => game.upgradePlot(sel)}>
              {max ? "MAX LEVEL" : game.money >= upCost ? `Upgrade · ${randShort(upCost)}` : `Need ${randShort(upCost)}`}
            </button>
            <button className="hl-demo" onClick={() => { game.demolishPlot(sel); setSel(null); }}>Demolish</button>
          </div>
        </div>
      )}
    </div>
  );
}

const CSS = `
.hl { position: fixed; inset: 0; display: flex; flex-direction: column; overflow: hidden;
  background: radial-gradient(1200px 700px at 50% -8%, #16263a 0%, #0b1320 52%, #070b12 100%);
  color: #eef2fa; font-family: 'Space Grotesk', system-ui, sans-serif; }
.hl-top { display: flex; align-items: center; gap: 12px; padding: 12px 14px 6px; flex: 0 0 auto; }
.hl-back { background: rgba(16,24,38,.85); border: 1px solid rgba(120,150,190,.3); color: #cfdaec; cursor: pointer;
  font-family: 'Oswald'; letter-spacing: 1px; padding: 8px 13px; font-size: 13px; white-space: nowrap;
  clip-path: polygon(0 5px,5px 0,100% 0,100% calc(100% - 5px),calc(100% - 5px) 100%,0 100%); }
.hl-back:hover { border-color: var(--acc); color: #fff; }
.hl-where { display: flex; align-items: center; gap: 10px; min-width: 0; }
.hl-flag { width: 40px; height: 28px; border-radius: 3px; box-shadow: 0 2px 8px rgba(0,0,0,.5); flex: 0 0 auto; }
.hl-kick { font-size: 10px; letter-spacing: 2.5px; color: var(--acc); font-weight: 700; }
.hl-name { font-family: 'Oswald'; font-size: 20px; font-weight: 600; line-height: 1.05; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.hl-chips { display: flex; gap: 8px; padding: 4px 14px 8px; overflow-x: auto; flex: 0 0 auto; -webkit-overflow-scrolling: touch; }
.hl-chips::-webkit-scrollbar { display: none; }
.hl-chip { flex: 1 0 auto; min-width: 86px; background: rgba(14,24,38,.7); border: 1px solid rgba(120,150,190,.18); padding: 7px 11px;
  clip-path: polygon(0 5px,5px 0,100% 0,100% calc(100% - 5px),calc(100% - 5px) 100%,0 100%); }
.hl-chip span { display: block; font-size: 9px; letter-spacing: 1.5px; color: #8294ad; }
.hl-chip b { font-family: 'Oswald'; font-size: 17px; }
.hl-warn { margin: 0 14px 6px; font-size: 12.5px; color: #f0b4b9; background: rgba(229,65,79,.12); border: 1px solid rgba(229,65,79,.32); padding: 8px 11px; border-radius: 6px; flex: 0 0 auto; }
.hl-stage { position: relative; flex: 1 1 auto; min-height: 0; }
.hl-hint { position: absolute; left: 50%; bottom: 14px; transform: translateX(-50%); pointer-events: none; font-size: 12px; letter-spacing: .5px; color: #aebfd2; background: rgba(8,14,22,.6); border: 1px solid rgba(120,150,190,.2); padding: 6px 13px; border-radius: 99px; -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px); white-space: nowrap; }

.hl-sheet { position: relative; flex: 0 0 auto; background: rgba(11,18,28,.97); border-top: 1px solid rgba(120,150,190,.25);
  padding: 14px 16px calc(16px + env(safe-area-inset-bottom)); box-shadow: 0 -12px 30px rgba(0,0,0,.5); animation: hlUp .22s ease; max-height: 52vh; overflow-y: auto; }
@keyframes hlUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
.hl-sheetX { position: absolute; top: 10px; right: 12px; background: none; border: none; color: #7e8ea3; font-size: 18px; cursor: pointer; padding: 4px; z-index: 2; }
.hl-sheetX:hover { color: #fff; }

.hl-pickHead { font-size: 11px; letter-spacing: 2px; color: #8294ad; margin-bottom: 10px; }
.hl-pick { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 8px; }
.hl-pickCard { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; cursor: pointer; text-align: left;
  background: rgba(16,26,40,.8); border: 1px solid rgba(120,150,190,.2); padding: 10px 12px; color: #eef2fa; transition: border-color .15s, transform .12s;
  clip-path: polygon(0 6px,6px 0,calc(100% - 6px) 0,100% 6px,100% calc(100% - 6px),calc(100% - 6px) 100%,6px 100%,0 calc(100% - 6px)); }
.hl-pickCard:hover:not(:disabled) { border-color: var(--acc); transform: translateY(-2px); }
.hl-pickCard.poor { opacity: .55; cursor: not-allowed; }
.hl-pickIcon { font-size: 22px; }
.hl-pickName { font-family: 'Oswald'; font-size: 13px; letter-spacing: .5px; }
.hl-pickOut { font-size: 11px; color: #4fd190; }
.hl-pickCost { font-family: 'Oswald'; font-size: 13px; color: #f0c860; margin-top: 2px; }
.hl-pickCost.no { color: #e5414f; }

.hl-sheetTop { display: flex; align-items: center; gap: 12px; padding-right: 28px; }
.hl-sheetIcon { font-size: 30px; line-height: 1; }
.hl-sheetName { flex: 1; min-width: 0; } .hl-sheetName b { font-family: 'Oswald'; font-size: 18px; letter-spacing: .5px; }
.hl-pips { display: flex; gap: 3px; margin-top: 5px; }
.hl-pips i { width: 16px; height: 5px; border-radius: 2px; background: rgba(255,255,255,.13); }
.hl-pips i.on { background: var(--acc); box-shadow: 0 0 6px var(--acc); }
.hl-sheetLvl { font-family: 'Oswald'; font-size: 13px; letter-spacing: 1px; color: var(--acc); white-space: nowrap; }
.hl-sheetOut { display: flex; justify-content: space-between; gap: 8px; font-size: 12.5px; color: #8294ad; margin: 10px 0 12px; flex-wrap: wrap; }
.hl-sheetOut b { color: #cfe0ea; } .hl-next b { color: #4fd190; }
.hl-actions { display: flex; gap: 8px; }
.hl-build { flex: 1; background: var(--acc); color: #07101a; border: none; cursor: pointer; font-family: 'Oswald'; font-size: 15px; letter-spacing: 1px; padding: 13px; font-weight: 600;
  clip-path: polygon(0 5px,5px 0,calc(100% - 5px) 0,100% 5px,100% calc(100% - 5px),calc(100% - 5px) 100%,5px 100%,0 calc(100% - 5px)); transition: filter .15s; }
.hl-build:hover:not(:disabled) { filter: brightness(1.12); }
.hl-build.poor { background: rgba(120,140,165,.2); color: #7e8ea3; cursor: not-allowed; }
.hl-build.max { background: rgba(79,209,144,.18); color: #4fd190; cursor: default; }
.hl-demo { flex: 0 0 auto; background: rgba(229,65,79,.14); color: #e5414f; border: 1px solid rgba(229,65,79,.35); cursor: pointer; font-family: 'Oswald'; font-size: 13px; letter-spacing: 1px; padding: 13px 16px;
  clip-path: polygon(0 5px,5px 0,calc(100% - 5px) 0,100% 5px,100% calc(100% - 5px),calc(100% - 5px) 100%,5px 100%,0 calc(100% - 5px)); }
.hl-demo:hover { background: rgba(229,65,79,.24); }

@media (min-width: 760px) {
  .hl-top, .hl-chips, .hl-warn { max-width: 1080px; margin-left: auto; margin-right: auto; width: 100%; }
  .hl-name { font-size: 24px; }
  .hl-sheet { max-width: 1080px; margin: 0 auto; width: 100%; border: 1px solid rgba(120,150,190,.25); border-bottom: none; border-radius: 14px 14px 0 0; }
  .hl-chip { flex: 0 1 auto; min-width: 120px; }
}
`;
