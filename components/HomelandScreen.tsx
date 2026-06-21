"use client";
import { useEffect, useRef, useState } from "react";
import { Flag } from "@/components/Flag";
import HomelandScene from "@/components/HomelandScene";
import { useGame } from "@/lib/store";
import { NATION } from "@/lib/nations";
import { fmt } from "@/lib/catalog";
import { BUILDINGS, BMAP, buildingOutput, randMoney, randShort } from "@/lib/economy";

/**
 * HomelandScreen — "Field Command 1916" HUD over the 3D home-front diorama.
 * components/HomelandScreen.tsx
 *
 * Aesthetic: gunmetal command table — telemetry resource rail, registration
 * corner brackets (echo the in-scene targeting reticle), brass/olive type.
 * Tap an empty plot to build, a built plot to upgrade or demolish.
 */

/** Smoothly count a number toward its target (telemetry feel on resource changes). */
function useCountUp(value: number, ms = 650) {
  const [disp, setDisp] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) { from.current = value; setDisp(value); return; }
    const start = performance.now(), a = from.current, b = value; let raf = 0;
    const step = (now: number) => {
      const k = Math.min(1, (now - start) / ms); const e = 1 - Math.pow(1 - k, 3);  // easeOutCubic
      const v = a + (b - a) * e; from.current = v; setDisp(v);
      if (k < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step); return () => cancelAnimationFrame(raf);
  }, [value, ms]);
  return disp;
}

// tiny inline readout icons (stroke = currentColor)
const IcoCoin = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="12" cy="12" r="8" /><path d="M12 8v8M9.5 10.2c0-1 1.1-1.7 2.5-1.7s2.5.7 2.5 1.7-1.1 1.5-2.5 1.7-2.5.8-2.5 1.8 1.1 1.6 2.5 1.6 2.5-.6 2.5-1.6" /></svg>);
const IcoFlow = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 17h10M4 17l3-3M4 17l3 3" /><path d="M20 7H10M20 7l-3-3M20 7l-3 3" /></svg>);
const IcoFood = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M12 3c-3 3-3 9 0 18 3-9 3-15 0-18Z" /><path d="M12 9c2-2 5-2 6-1-1 3-4 4-6 3M12 12c-2-2-5-2-6-1 1 3 4 4 6 3" /></svg>);
const IcoPop = () => (<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><circle cx="9" cy="8" r="3" /><path d="M3.5 19c0-3 2.5-5 5.5-5s5.5 2 5.5 5" /><path d="M16 6.5a2.6 2.6 0 0 1 0 5M17 14.2c2.4.5 4 2.4 4 4.8" /></svg>);

export default function HomelandScreen({ onBack }: { onBack?: () => void }) {
  const game = useGame();
  const nat = (game.nation && NATION[game.nation]) || null;
  const accent = nat?.accent || "#56b9cf";
  const plots = game.plots || [];
  const [sel, setSel] = useState<number | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    game.tickIncome();
    const t = setInterval(() => game.tickIncome(), 60000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const money = useCountUp(game.money);

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

      {/* signature: registration brackets framing the command table */}
      <i className="hl-reg tl" /><i className="hl-reg tr" /><i className="hl-reg bl" /><i className="hl-reg br" />

      <div className="hl-top">
        <button className="hl-back" onClick={onBack}>← HQ</button>
        <div className="hl-where">
          <div className="hl-flagPlate">{nat && <Flag id={nat.id} className="hl-flag" />}</div>
          <div className="hl-titles">
            <div className="hl-kick">HOME FRONT · SECTOR 1916</div>
            <div className="hl-name">{nat?.name || "The Homeland"}</div>
          </div>
        </div>
      </div>

      {/* telemetry resource rail */}
      <div className="hl-rail">
        <div className="hl-read">
          <span className="hl-ico" style={{ color: "#e0b24e" }}><IcoCoin /></span>
          <div><i>TREASURY</i><b style={{ color: "#f0c860" }}>{randMoney(Math.floor(money))}</b></div>
        </div>
        <div className="hl-read">
          <span className="hl-ico" style={{ color: game.incomePerHour >= 0 ? "#4fd190" : "#e5414f" }}><IcoFlow /></span>
          <div><i>NET / MO</i><b style={{ color: game.incomePerHour >= 0 ? "#4fd190" : "#e5414f" }}>{game.incomePerHour >= 0 ? "+" : ""}{randShort(game.incomePerHour)}</b></div>
        </div>
        <div className="hl-read">
          <span className="hl-ico" style={{ color: game.starving ? "#e5414f" : "#9ec24a" }}><IcoFood /></span>
          <div><i>FOOD</i><b style={{ color: game.starving ? "#e5414f" : "#cfe0ea" }}>{game.econ.food}<small>/{game.foodNeed}</small></b></div>
        </div>
        <div className="hl-read">
          <span className="hl-ico" style={{ color: "var(--acc)" }}><IcoPop /></span>
          <div><i>POPULATION</i><b style={{ color: "#cfe0ea" }}>{game.population}<small>M</small></b></div>
        </div>
      </div>

      {game.starving && (
        <div className="hl-warn">
          <span className="hl-warnTag">SUPPLY ALERT</span>
          Your people are starving — output runs at half. Build more <b>State Farmland</b>.
        </div>
      )}

      <div className="hl-stage">
        <HomelandScene plots={plots} selected={sel} accent={accent} nation={game.nation} onSelect={setSel} onReady={() => setReady(true)} />

        {/* inner stage corner ticks */}
        <i className="hl-tick tl" /><i className="hl-tick tr" /><i className="hl-tick bl" /><i className="hl-tick br" />

        {sel == null && ready && <div className="hl-hint">Tap a plot to build · drag to pan · pinch / scroll to zoom</div>}

        {/* loader (always present, fades out on first painted frame) */}
        <div className={"hl-skel" + (ready ? " gone" : "")}>
          <div className="hl-skelGrid" />
          <div className="hl-skelBox"><span className="hl-spin" />DEPLOYING SECTOR…</div>
        </div>
      </div>

      {/* empty plot → choose a building */}
      {sel != null && !built && (
        <div className="hl-sheet">
          <div className="hl-sheetGrip" />
          <button className="hl-sheetX" onClick={() => setSel(null)}>✕</button>
          <div className="hl-pickHead"><span className="hl-bar" />EMPTY PLOT · ASSIGN A STRUCTURE</div>
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
          <div className="hl-sheetGrip" />
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
            <span>Output now <b>{outText(def.id, lvl)}</b></span>
            {!max && <span className="hl-next">→ Lv{lvl + 1} <b>{outText(def.id, lvl + 1)}</b></span>}
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
  background:
    radial-gradient(1100px 620px at 50% -10%, #18293d 0%, #0c1422 55%, #070b12 100%),
    repeating-linear-gradient(0deg, rgba(255,255,255,.012) 0 1px, transparent 1px 3px);
  color: #eef2fa; font-family: 'Space Grotesk', system-ui, sans-serif;
  --mono: 'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace;
  --hair: rgba(120,150,190,.16); --panel: rgba(14,22,34,.82); }

/* signature registration brackets */
.hl-reg { position: absolute; width: 22px; height: 22px; pointer-events: none; z-index: 5; opacity: .55; }
.hl-reg::before, .hl-reg::after { content: ""; position: absolute; background: var(--acc); }
.hl-reg::before { width: 22px; height: 2px; } .hl-reg::after { width: 2px; height: 22px; }
.hl-reg.tl { top: 10px; left: 10px; } .hl-reg.tl::before, .hl-reg.tl::after { top: 0; left: 0; }
.hl-reg.tr { top: 10px; right: 10px; } .hl-reg.tr::before { top: 0; right: 0; } .hl-reg.tr::after { top: 0; right: 0; }
.hl-reg.bl { bottom: 10px; left: 10px; } .hl-reg.bl::before { bottom: 0; left: 0; } .hl-reg.bl::after { bottom: 0; left: 0; }
.hl-reg.br { bottom: 10px; right: 10px; } .hl-reg.br::before { bottom: 0; right: 0; } .hl-reg.br::after { bottom: 0; right: 0; }

.hl-top { display: flex; align-items: center; gap: 12px; padding: 14px 18px 8px; flex: 0 0 auto; }
.hl-back { background: var(--panel); border: 1px solid var(--hair); color: #cfdaec; cursor: pointer;
  font-family: 'Oswald'; letter-spacing: 1.5px; padding: 9px 14px; font-size: 13px; white-space: nowrap;
  clip-path: polygon(0 6px,6px 0,100% 0,100% calc(100% - 6px),calc(100% - 6px) 100%,0 100%); transition: border-color .15s, color .15s; }
.hl-back:hover, .hl-back:focus-visible { border-color: var(--acc); color: #fff; outline: none; }
.hl-where { display: flex; align-items: center; gap: 12px; min-width: 0; }
.hl-flagPlate { padding: 3px; border: 1px solid var(--hair); background: rgba(8,14,22,.6);
  clip-path: polygon(0 4px,4px 0,100% 0,100% calc(100% - 4px),calc(100% - 4px) 100%,0 100%); flex: 0 0 auto; }
.hl-flag { width: 42px; height: 28px; display: block; box-shadow: 0 2px 8px rgba(0,0,0,.5); }
.hl-kick { font-size: 10px; letter-spacing: 3px; color: var(--acc); font-weight: 700; font-family: var(--mono); }
.hl-name { font-family: 'Oswald'; font-size: 22px; font-weight: 600; line-height: 1.04; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }

/* telemetry rail */
.hl-rail { display: flex; gap: 0; margin: 4px 18px 8px; flex: 0 0 auto; overflow-x: auto; -webkit-overflow-scrolling: touch;
  border-top: 1px solid var(--hair); border-bottom: 1px solid var(--hair); background: linear-gradient(180deg, rgba(12,20,32,.5), rgba(12,20,32,.15)); }
.hl-rail::-webkit-scrollbar { display: none; }
.hl-read { flex: 1 0 auto; min-width: 120px; display: flex; align-items: center; gap: 9px; padding: 9px 14px; position: relative; }
.hl-read + .hl-read::before { content: ""; position: absolute; left: 0; top: 18%; height: 64%; width: 1px; background: var(--hair); }
.hl-ico { width: 19px; height: 19px; flex: 0 0 auto; opacity: .9; } .hl-ico svg { width: 100%; height: 100%; display: block; }
.hl-read i { display: block; font-style: normal; font-size: 9px; letter-spacing: 1.8px; color: #7e90a8; font-family: var(--mono); }
.hl-read b { font-family: var(--mono); font-size: 17px; font-weight: 600; letter-spacing: -.3px; line-height: 1.15; }
.hl-read b small { font-size: 11px; color: #7e90a8; font-weight: 400; }

.hl-warn { margin: 0 18px 8px; font-size: 12.5px; color: #f0b4b9; background: rgba(229,65,79,.1); border: 1px solid rgba(229,65,79,.32);
  padding: 9px 12px; display: flex; align-items: center; gap: 10px; flex: 0 0 auto;
  clip-path: polygon(0 5px,5px 0,100% 0,100% calc(100% - 5px),calc(100% - 5px) 100%,0 100%); }
.hl-warn b { color: #ffd0d4; } .hl-warnTag { font-family: var(--mono); font-size: 9px; letter-spacing: 1.5px; color: #fff;
  background: #e5414f; padding: 3px 7px; flex: 0 0 auto; }

.hl-stage { position: relative; flex: 1 1 auto; min-height: 0; }
.hl-tick { position: absolute; width: 13px; height: 13px; pointer-events: none; z-index: 3; opacity: .4; }
.hl-tick::before, .hl-tick::after { content: ""; position: absolute; background: #aebfd2; }
.hl-tick::before { width: 13px; height: 1px; } .hl-tick::after { width: 1px; height: 13px; }
.hl-tick.tl { top: 12px; left: 12px; } .hl-tick.tr { top: 12px; right: 12px; } .hl-tick.tr::before,.hl-tick.tr::after{ right: 0; }
.hl-tick.bl { bottom: 12px; left: 12px; } .hl-tick.bl::before,.hl-tick.bl::after{ bottom: 0; }
.hl-tick.br { bottom: 12px; right: 12px; } .hl-tick.br::before,.hl-tick.br::after{ bottom: 0; right: 0; }

.hl-hint { position: absolute; left: 50%; bottom: 16px; transform: translateX(-50%); pointer-events: none; font-size: 11.5px;
  letter-spacing: .4px; color: #aebfd2; background: rgba(8,14,22,.62); border: 1px solid var(--hair); padding: 7px 14px; border-radius: 99px;
  -webkit-backdrop-filter: blur(5px); backdrop-filter: blur(5px); white-space: nowrap; font-family: var(--mono); animation: hlFade .5s ease; }
@keyframes hlFade { from { opacity: 0; } to { opacity: 1; } }

/* stage loader */
.hl-skel { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: radial-gradient(600px 400px at 50% 40%, #12203200, #0a121c 100%);
  transition: opacity .5s ease, visibility .5s; z-index: 4; }
.hl-skel.gone { opacity: 0; visibility: hidden; pointer-events: none; }
.hl-skelGrid { position: absolute; inset: 0; opacity: .25;
  background-image: linear-gradient(var(--hair) 1px, transparent 1px), linear-gradient(90deg, var(--hair) 1px, transparent 1px);
  background-size: 38px 38px; mask: radial-gradient(420px 320px at 50% 45%, #000 30%, transparent 75%); -webkit-mask: radial-gradient(420px 320px at 50% 45%, #000 30%, transparent 75%); animation: hlGrid 6s linear infinite; }
@keyframes hlGrid { to { background-position: 38px 38px; } }
.hl-skelBox { display: flex; align-items: center; gap: 10px; font-family: var(--mono); font-size: 12px; letter-spacing: 2px; color: var(--acc);
  border: 1px solid var(--hair); background: rgba(8,14,22,.7); padding: 11px 18px; z-index: 1;
  clip-path: polygon(0 5px,5px 0,100% 0,100% calc(100% - 5px),calc(100% - 5px) 100%,0 100%); }
.hl-spin { width: 13px; height: 13px; border: 2px solid var(--hair); border-top-color: var(--acc); border-radius: 50%; animation: hlSpin .8s linear infinite; }
@keyframes hlSpin { to { transform: rotate(360deg); } }

/* bottom sheet */
.hl-sheet { position: relative; flex: 0 0 auto; background: rgba(10,17,27,.97); border-top: 1px solid var(--hair);
  padding: 16px 18px calc(16px + env(safe-area-inset-bottom)); box-shadow: 0 -14px 34px rgba(0,0,0,.55); animation: hlUp .24s cubic-bezier(.2,.9,.25,1); max-height: 54vh; overflow-y: auto; }
@keyframes hlUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
.hl-sheetGrip { position: absolute; top: 7px; left: 50%; transform: translateX(-50%); width: 38px; height: 3px; border-radius: 2px; background: rgba(150,170,200,.3); }
.hl-sheetX { position: absolute; top: 12px; right: 14px; background: none; border: none; color: #7e8ea3; font-size: 18px; cursor: pointer; padding: 4px; z-index: 2; }
.hl-sheetX:hover, .hl-sheetX:focus-visible { color: #fff; outline: none; }

.hl-pickHead { display: flex; align-items: center; gap: 8px; font-family: var(--mono); font-size: 11px; letter-spacing: 2px; color: #8294ad; margin: 6px 0 12px; }
.hl-bar { width: 3px; height: 13px; background: var(--acc); display: inline-block; }
.hl-pick { display: grid; grid-template-columns: repeat(auto-fit, minmax(146px, 1fr)); gap: 8px; }
.hl-pickCard { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; cursor: pointer; text-align: left;
  background: linear-gradient(180deg, rgba(20,32,48,.85), rgba(14,24,38,.85)); border: 1px solid var(--hair); padding: 11px 13px; color: #eef2fa;
  transition: border-color .15s, transform .12s, box-shadow .15s;
  clip-path: polygon(0 7px,7px 0,calc(100% - 7px) 0,100% 7px,100% calc(100% - 7px),calc(100% - 7px) 100%,7px 100%,0 calc(100% - 7px)); }
.hl-pickCard:hover:not(:disabled), .hl-pickCard:focus-visible:not(:disabled) { border-color: var(--acc); transform: translateY(-2px); box-shadow: 0 6px 18px rgba(0,0,0,.35); outline: none; }
.hl-pickCard.poor { opacity: .5; cursor: not-allowed; }
.hl-pickIcon { font-size: 23px; line-height: 1; margin-bottom: 2px; }
.hl-pickName { font-family: 'Oswald'; font-size: 13.5px; letter-spacing: .5px; }
.hl-pickOut { font-size: 11px; color: #4fd190; font-family: var(--mono); }
.hl-pickCost { font-family: var(--mono); font-size: 13px; color: #f0c860; margin-top: 3px; font-weight: 600; }
.hl-pickCost.no { color: #e5414f; }

.hl-sheetTop { display: flex; align-items: center; gap: 13px; padding-right: 28px; }
.hl-sheetIcon { font-size: 31px; line-height: 1; filter: drop-shadow(0 2px 6px rgba(0,0,0,.4)); }
.hl-sheetName { flex: 1; min-width: 0; } .hl-sheetName b { font-family: 'Oswald'; font-size: 19px; letter-spacing: .5px; }
.hl-pips { display: flex; gap: 3px; margin-top: 6px; }
.hl-pips i { width: 17px; height: 5px; border-radius: 2px; background: rgba(255,255,255,.12); transition: background .2s; }
.hl-pips i.on { background: var(--acc); box-shadow: 0 0 7px var(--acc); }
.hl-sheetLvl { font-family: var(--mono); font-size: 12px; letter-spacing: 1px; color: var(--acc); white-space: nowrap; border: 1px solid var(--hair); padding: 4px 8px; }
.hl-sheetOut { display: flex; justify-content: space-between; gap: 8px; font-size: 12px; color: #8294ad; margin: 13px 0 13px; flex-wrap: wrap; font-family: var(--mono); }
.hl-sheetOut b { color: #cfe0ea; } .hl-next b { color: #4fd190; }
.hl-actions { display: flex; gap: 8px; }
.hl-build { flex: 1; background: var(--acc); color: #07101a; border: none; cursor: pointer; font-family: 'Oswald'; font-size: 15px; letter-spacing: 1.2px; padding: 14px; font-weight: 600;
  clip-path: polygon(0 5px,5px 0,calc(100% - 5px) 0,100% 5px,100% calc(100% - 5px),calc(100% - 5px) 100%,5px 100%,0 calc(100% - 5px)); transition: filter .15s; }
.hl-build:hover:not(:disabled), .hl-build:focus-visible:not(:disabled) { filter: brightness(1.13); outline: none; }
.hl-build.poor { background: rgba(120,140,165,.18); color: #7e8ea3; cursor: not-allowed; }
.hl-build.max { background: rgba(79,209,144,.16); color: #4fd190; cursor: default; }
.hl-demo { flex: 0 0 auto; background: rgba(229,65,79,.12); color: #e5414f; border: 1px solid rgba(229,65,79,.35); cursor: pointer; font-family: 'Oswald'; font-size: 13px; letter-spacing: 1px; padding: 14px 17px;
  clip-path: polygon(0 5px,5px 0,calc(100% - 5px) 0,100% 5px,100% calc(100% - 5px),calc(100% - 5px) 100%,5px 100%,0 calc(100% - 5px)); transition: background .15s; }
.hl-demo:hover, .hl-demo:focus-visible { background: rgba(229,65,79,.24); outline: none; }

@media (min-width: 760px) {
  .hl-top, .hl-rail, .hl-warn { max-width: 1100px; margin-left: auto; margin-right: auto; width: 100%; }
  .hl-name { font-size: 26px; }
  .hl-read { flex: 0 1 auto; min-width: 150px; }
  .hl-sheet { max-width: 1100px; margin: 0 auto; width: 100%; border: 1px solid var(--hair); border-bottom: none; border-radius: 14px 14px 0 0; }
}
@media (prefers-reduced-motion: reduce) {
  .hl-sheet, .hl-hint, .hl-skelGrid, .hl-spin { animation: none; }
  .hl-skel { transition: opacity .2s; }
}
`;