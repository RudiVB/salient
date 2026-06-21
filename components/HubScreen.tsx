"use client";
import { useEffect } from "react";
import PolyScene from "@/components/PolyScene";
import Onboarding from "@/components/Onboarding";
import { Flag } from "@/components/Flag";
import { useGame } from "@/lib/store";
import { NATION } from "@/lib/nations";
import { fmt } from "@/lib/catalog";
import { randMoney } from "@/lib/economy";

/**
 * HubScreen — "Command HQ": premium war-room strategy menu.
 * components/HubScreen.tsx
 */
export default function HubScreen({
  onCampaign, onBarracks, onTrade, onWorld, onMenu, onHomeland, onDoctrine, onHeroes,
}: { onCampaign?: () => void; onBarracks?: () => void; onTrade?: () => void; onWorld?: () => void; onMenu?: () => void; onHomeland?: () => void; onDoctrine?: () => void; onHeroes?: () => void }) {
  const game = useGame();
  const nat = (game.nation && NATION[game.nation]) || null;
  const accent = nat?.accent || "#56b9cf";
  const regiments = game.collection.filter((u) => u.troops > 0).length;
  const heroCount = game.collection.filter((u) => u.hero).length;
  const terr = game.owned?.length || 0;
  const terrIncome = terr * 15;

  useEffect(() => {
    game.tickIncome();
    const t = setInterval(() => game.tickIncome(), 60000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const rankPct = game.rank.nextMin != null
    ? Math.min(100, (game.wins - game.rank.min) / (game.rank.nextMin - game.rank.min) * 100) : 100;

  const primary = [
    { key: "world", icon: "🌍", title: "World Map", sub: `${terr} region${terr === 1 ? "" : "s"} held — take the war to the great powers.`, on: onWorld, accent: "#4fd190" },
    { key: "campaign", icon: "⚔", title: "Campaign", sub: "Push up a front, rung by tougher rung.", on: onCampaign, accent: "#e5414f" },
  ];
  const secondary = [
    { key: "homeland", icon: "🏛", title: "Homeland", sub: game.starving ? "⚠ People are starving!" : `+${randMoney(game.econ.income)}/mo industry`, on: onHomeland, accent: accent },
    { key: "barracks", icon: "🎖", title: "Barracks", sub: `${regiments} regiment${regiments === 1 ? "" : "s"} active`, on: onBarracks, accent: "#56b9cf" },
    { key: "doctrine", icon: "🔬", title: "Doctrine", sub: `${game.research} research banked`, on: onDoctrine, accent: "#9b8cff" },
    { key: "heroes", icon: "🏅", title: "Commanders", sub: heroCount > 0 ? `${heroCount} leading` : "None yet", on: onHeroes, accent: "#f0a860" },
    { key: "trade", icon: "⛟", title: "Trade", sub: "Passive income routes", on: onTrade, accent: "#f0c860", soon: !onTrade },
  ];

  const ticker = [
    { label: "TREASURY", val: randMoney(Math.floor(game.money)), color: "#f0c860" },
    { label: "NET / MO", val: `${game.incomePerHour >= 0 ? "+" : ""}${randMoney(game.incomePerHour)}`, color: game.incomePerHour >= 0 ? "#4fd190" : "#e5414f" },
    { label: "FOOD", val: `${game.econ.food}/${game.foodNeed}`, color: game.starving ? "#e5414f" : "#4fd190" },
    { label: "SUPPLIES", val: `◆ ${fmt(game.supplies)}`, color: "#cfe0ea" },
    { label: "RESEARCH", val: `🔬 ${game.research}`, color: "#8fdcff" },
  ];

  return (
    <div className="hub" style={{ ["--acc" as any]: accent }}>
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="hub-bg"><PolyScene className="hub-scene" /></div>
      <div className="hub-shade" />
      <div className="hub-grid-tex" />
      <div className="hub-glow" />

      <div className="hub-wrap">
        {/* welcome-back report */}
        {game.awayReport && (
          <div className="hub-away">
            <button className="hub-awayX" onClick={game.dismissAway}>✕</button>
            <div className="hub-awayKick">◢ WHILE YOU WERE AWAY ◣</div>
            <div className="hub-awayBody">
              The war advanced <b>{game.awayReport.turns} turns</b>. {game.awayReport.lost.length > 0
                ? <>You lost <b style={{ color: "#e5414f" }}>{game.awayReport.lost.join(", ")}</b>. </>
                : <>Your lines held. </>}
              <b>{game.awayReport.leaderName}</b> now leads with <b>{game.awayReport.leaderN}</b> regions — you hold <b>{game.awayReport.held}</b>.
            </div>
            {onWorld && <button className="hub-awayCta" onClick={() => { game.dismissAway(); onWorld(); }}>Review the front ▸</button>}
          </div>
        )}

        {/* onboarding: welcome briefing + field orders */}
        <Onboarding onHomeland={onHomeland} onBarracks={onBarracks} onWorld={onWorld} onDoctrine={onDoctrine} />

        {/* header */}
        <div className="hub-head">
          <div className="hub-nation">
            {nat && <span className="hub-flagWrap"><Flag id={nat.id} className="hub-flag" /></span>}
            <div className="hub-natText">
              <div className="hub-kick">◢ COMMAND HQ · 1916 ◣</div>
              <div className="hub-name">{nat?.name || "High Command"}</div>
            </div>
          </div>
          {onMenu && <button className="hub-menuBtn" onClick={onMenu}>☰</button>}
        </div>

        {/* rank ribbon */}
        <div className="hub-rank">
          <div className="hub-rankBadge">★</div>
          <div className="hub-rankMid">
            <div className="hub-rankTop">
              <span className="hub-rankName">{game.rank.name}</span>
              {game.streak > 0 && <span className="hub-streak">🔥 {game.streak}</span>}
            </div>
            <div className="hub-rankBar"><i style={{ width: `${rankPct}%` }} /></div>
            <div className="hub-rankProg">
              {game.rank.nextMin != null ? <>Next: {game.rank.nextName} · {game.wins}/{game.rank.nextMin} wins</> : <>Highest rank · {game.wins} wins</>}
            </div>
          </div>
        </div>

        {/* resource ticker */}
        <div className="hub-ticker">
          {ticker.map((t, i) => (
            <div key={t.label} className="hub-tick">
              <span className="hub-tickL">{t.label}</span>
              <b style={{ color: t.color }}>{t.val}</b>
            </div>
          ))}
        </div>

        {/* primary command tiles */}
        <div className="hub-primary">
          {primary.map((c) => (
            <button key={c.key} className="hub-big" style={{ ["--cacc" as any]: c.accent }} onClick={c.on}>
              <div className="hub-bigIcon">{c.icon}</div>
              <div className="hub-bigText">
                <div className="hub-bigTitle">{c.title}</div>
                <div className="hub-bigSub">{c.sub}</div>
              </div>
              <div className="hub-bigGo">DEPLOY ▸</div>
            </button>
          ))}
        </div>

        {/* secondary tiles */}
        <div className="hub-sec">
          {secondary.map((c) => (
            <button key={c.key} className={"hub-card" + (c.soon ? " soon" : "")} style={{ ["--cacc" as any]: c.accent }} disabled={!!c.soon} onClick={c.on}>
              <div className="hub-cIcon">{c.icon}</div>
              <div className="hub-cTitle">{c.title}{c.soon && <span className="hub-soon">SOON</span>}</div>
              <div className="hub-cSub">{c.sub}</div>
            </button>
          ))}
        </div>

        {/* economy readout */}
        <div className="hub-econ">
          <div className="hub-econHead">WAR ECONOMY · <b style={{ color: game.incomePerHour >= 0 ? "#4fd190" : "#e5414f" }}>{game.incomePerHour >= 0 ? "+" : ""}{randMoney(game.incomePerHour)}/mo net</b></div>
          <div className="hub-econRows">
            <div className="hub-econRow"><span>Homeland industry</span><b style={{ color: "#4fd190" }}>+{randMoney(game.econ.income)}</b></div>
            <div className="hub-econRow"><span>Territory · {terr}</span><b>+{randMoney(terrIncome)}</b></div>
            <div className="hub-econRow"><span>Trade routes</span><b>+{randMoney(game.tradeIncome)}</b></div>
            <div className="hub-econRow"><span>Army wages</span><b style={{ color: "#e5414f" }}>−{randMoney(game.upkeepPerHour)}</b></div>
            {game.starving && <div className="hub-econRow warn"><span>⚠ Starvation</span><b style={{ color: "#e5414f" }}>−50%</b></div>}
          </div>
          <div className="hub-econHint">Build <b>factories &amp; mines</b> for income and <b>farms</b> to feed the army — keep the economy ahead of your wages.</div>
        </div>
      </div>
    </div>
  );
}

const CSS = `
.hub { position: fixed; inset: 0; z-index: 25; overflow-y: auto; color: #e9eef7;
  font-family: 'Oswald', system-ui, sans-serif; background: #060912;
  --fill: #0e1826;
  --cham: polygon(0 8px, 8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px));
  --chamS: polygon(0 4px, 4px 0, calc(100% - 4px) 0, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0 calc(100% - 4px)); }
.hub-bg { position: fixed; inset: 0; z-index: 0; }
.hub-scene { position: absolute; inset: 0; }
.hub-shade { position: fixed; inset: 0; z-index: 1; pointer-events: none;
  background: radial-gradient(120% 80% at 50% -10%, rgba(7,11,18,.2), rgba(6,9,18,.78) 55%, rgba(6,9,18,.96) 100%); }
.hub-grid-tex { position: fixed; inset: 0; z-index: 1; pointer-events: none; opacity: .5;
  background-image: linear-gradient(rgba(120,160,200,.045) 1px, transparent 1px), linear-gradient(90deg, rgba(120,160,200,.045) 1px, transparent 1px);
  background-size: 44px 44px; mask-image: radial-gradient(120% 90% at 50% 20%, #000 30%, transparent 80%); }
.hub-glow { position: fixed; top: -120px; left: 50%; transform: translateX(-50%); width: 700px; height: 320px; z-index: 1; pointer-events: none;
  background: radial-gradient(closest-side, color-mix(in srgb, var(--acc) 30%, transparent), transparent); opacity: .5; filter: blur(8px); }

.hub-wrap { position: relative; z-index: 2; max-width: 1000px; margin: 0 auto; padding: 0 16px 44px; }

.hub-away { position: relative; margin: 18px 0 2px; padding: 14px 16px; background: linear-gradient(120deg, rgba(40,30,12,.9), rgba(18,22,32,.85));
  border: 1px solid rgba(240,200,96,.35); clip-path: var(--cham); animation: hubAway .35s ease; }
@keyframes hubAway { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
.hub-awayX { position: absolute; top: 8px; right: 10px; background: none; border: none; color: #b09a6a; font-size: 15px; cursor: pointer; }
.hub-awayX:hover { color: #fff; }
.hub-awayKick { font-family: 'Space Grotesk', monospace; font-size: 10px; letter-spacing: 3px; color: #f0c860; margin-bottom: 6px; }
.hub-awayBody { font-family: 'Space Grotesk', sans-serif; font-size: 13px; color: #e3e9f2; font-weight: 300; line-height: 1.5; }
.hub-awayBody b { font-weight: 600; color: #fff; }
.hub-awayCta { margin-top: 10px; cursor: pointer; font-family: 'Oswald'; font-weight: 600; font-size: 13px; letter-spacing: 1px; color: #2a1d00;
  background: linear-gradient(180deg, #ffe08a, #e0b042); border: none; padding: 8px 14px; clip-path: var(--chamS); }
.hub-awayCta:hover { filter: brightness(1.08); }

.hub-head { display: flex; align-items: center; gap: 14px; padding: 22px 4px 12px; }
.hub-nation { display: flex; align-items: center; gap: 13px; flex: 1; min-width: 0; }
.hub-flagWrap { position: relative; padding: 3px; background: linear-gradient(135deg, var(--acc), transparent); clip-path: var(--chamS); flex: 0 0 auto; }
.hub-flag { width: 52px; height: 35px; clip-path: var(--chamS); display: block; box-shadow: 0 2px 10px rgba(0,0,0,.6); }
.hub-kick { font-family: 'Space Grotesk', monospace; font-size: 11px; letter-spacing: 3px; color: #f0c860; }
.hub-name { font-size: 24px; font-weight: 700; letter-spacing: 1px; line-height: 1.05; text-shadow: 0 2px 12px rgba(0,0,0,.5); }
.hub-menuBtn { cursor: pointer; font-size: 18px; color: #aebbd2; background: var(--fill); border: 1px solid rgba(120,150,190,.18);
  clip-path: var(--chamS); width: 44px; height: 44px; flex: 0 0 auto; }
.hub-menuBtn:hover { color: #fff; background: #16243a; }

.hub-rank { display: flex; align-items: center; gap: 13px; padding: 12px 15px; margin-bottom: 12px;
  background: linear-gradient(120deg, rgba(22,32,50,.8), rgba(12,18,28,.72)); border: 1px solid rgba(120,150,190,.16); clip-path: var(--cham); }
.hub-rankBadge { width: 44px; height: 44px; display: grid; place-items: center; font-size: 22px; color: #2a1d00; flex: 0 0 auto;
  background: linear-gradient(180deg, #ffe08a, #c79a30); clip-path: var(--chamS); box-shadow: 0 2px 12px rgba(240,200,96,.35); }
.hub-rankMid { flex: 1; min-width: 0; }
.hub-rankTop { display: flex; align-items: center; gap: 10px; }
.hub-rankName { font-size: 19px; font-weight: 700; letter-spacing: 1.5px; color: #f0c860; }
.hub-streak { font-size: 13px; color: #ff9a5e; letter-spacing: .5px; }
.hub-rankBar { height: 5px; background: rgba(150,180,225,.14); border-radius: 99px; overflow: hidden; margin: 5px 0 4px; }
.hub-rankBar i { display: block; height: 100%; background: linear-gradient(90deg, #f0c860, var(--acc)); transition: width .5s; }
.hub-rankProg { font-family: 'Space Grotesk', monospace; font-size: 10.5px; color: #8aa0bd; }

.hub-ticker { display: flex; gap: 8px; overflow-x: auto; padding-bottom: 4px; margin-bottom: 16px; -webkit-overflow-scrolling: touch; scrollbar-width: none; }
.hub-ticker::-webkit-scrollbar { display: none; }
.hub-tick { flex: 1 0 auto; min-width: 96px; background: rgba(12,20,32,.78); border: 1px solid rgba(120,150,190,.14);
  border-top: 2px solid color-mix(in srgb, var(--acc) 55%, transparent); padding: 8px 12px; clip-path: var(--chamS); }
.hub-tickL { display: block; font-family: 'Space Grotesk', monospace; font-size: 8.5px; letter-spacing: 2px; color: #7d8ba6; margin-bottom: 2px; }
.hub-tick b { font-size: 17px; }

.hub-primary { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px; }
.hub-big { position: relative; text-align: left; cursor: pointer; border: none; color: #e9eef7; overflow: hidden;
  background: linear-gradient(150deg, color-mix(in srgb, var(--cacc) 26%, #0e1826), #0c1422 70%);
  border: 1px solid color-mix(in srgb, var(--cacc) 45%, transparent); clip-path: var(--cham);
  padding: 18px 16px 16px; min-height: 132px; display: flex; flex-direction: column; transition: transform .14s, box-shadow .15s; }
.hub-big::after { content: ""; position: absolute; right: -30px; top: -30px; width: 120px; height: 120px; border-radius: 50%;
  background: radial-gradient(closest-side, color-mix(in srgb, var(--cacc) 40%, transparent), transparent); opacity: .5; }
.hub-big:hover { transform: translateY(-3px); box-shadow: 0 10px 30px rgba(0,0,0,.45), 0 0 0 1px var(--cacc); }
.hub-bigIcon { font-size: 34px; filter: drop-shadow(0 3px 8px rgba(0,0,0,.4)); }
.hub-bigText { flex: 1; margin-top: 8px; }
.hub-bigTitle { font-size: 21px; font-weight: 700; letter-spacing: 1px; }
.hub-bigSub { font-size: 12px; color: #b9c6da; font-weight: 300; margin-top: 3px; line-height: 1.35; }
.hub-bigGo { font-family: 'Space Grotesk', monospace; font-size: 11px; letter-spacing: 2px; font-weight: 700;
  color: var(--cacc); margin-top: 10px; }

.hub-sec { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-bottom: 16px; }
.hub-card { position: relative; text-align: left; cursor: pointer; color: #e9eef7;
  background: rgba(13,21,33,.82); border: 1px solid rgba(120,150,190,.16); border-bottom: 2px solid color-mix(in srgb, var(--cacc) 60%, transparent);
  clip-path: var(--chamS); padding: 13px 12px 14px; transition: transform .13s, background .15s; }
.hub-card:hover:not(.soon) { transform: translateY(-2px); background: rgba(20,30,46,.9); }
.hub-card.soon { opacity: .5; cursor: default; }
.hub-cIcon { font-size: 23px; }
.hub-cTitle { font-size: 14px; font-weight: 600; letter-spacing: .4px; margin-top: 6px; display: flex; align-items: center; gap: 6px; }
.hub-cSub { font-size: 10.5px; color: #93a4bd; font-weight: 300; margin-top: 2px; line-height: 1.3; }
.hub-soon { font-family: 'Space Grotesk', monospace; font-size: 8px; letter-spacing: 1px; color: #9b8cff; background: rgba(155,140,255,.15); padding: 1px 5px; clip-path: var(--chamS); }

.hub-econ { background: rgba(10,16,26,.7); border: 1px solid rgba(120,150,190,.14); clip-path: var(--cham); padding: 14px 16px; }
.hub-econHead { font-family: 'Space Grotesk', monospace; font-size: 11px; letter-spacing: 2px; color: #93a2bd; margin-bottom: 10px; }
.hub-econRows { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.hub-econRow { background: rgba(14,24,38,.7); clip-path: var(--chamS); padding: 9px 11px; }
.hub-econRow span { display: block; font-size: 10px; color: #93a2bd; font-family: 'Space Grotesk', monospace; }
.hub-econRow b { font-size: 14px; color: #cfe0ea; }
.hub-econRow.warn { border: 1px solid rgba(229,65,79,.4); }
.hub-econHint { font-size: 11.5px; color: #9fb0cc; font-weight: 300; margin-top: 10px; }
.hub-econHint b { color: #4fd190; font-weight: 600; }

@media (max-width: 720px) {
  .hub-name { font-size: 19px; }
  .hub-primary { grid-template-columns: 1fr; }
  .hub-sec { grid-template-columns: repeat(3, 1fr); }
  .hub-econRows { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 420px) {
  .hub-sec { grid-template-columns: repeat(2, 1fr); }
}
`;
