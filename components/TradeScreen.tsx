"use client";
import { useEffect } from "react";
import PolyScene from "@/components/PolyScene";
import { useGame } from "@/lib/store";
import { fmt } from "@/lib/catalog";
import { randMoney, randShort } from "@/lib/economy";
import { NATION } from "@/lib/nations";
import { ROUTES, TRADE_MAX, routeIncome, routeCost } from "@/lib/trade";

/**
 * TradeScreen — build & upgrade trade routes for passive £/hr. components/TradeScreen.tsx
 * Props: onBack
 */
export default function TradeScreen({ onBack }: { onBack?: () => void }) {
  const game = useGame();
  const accent = (game.nation && NATION[game.nation]?.accent) || "#56b9cf";
  const terr = game.owned?.length || 0;

  useEffect(() => { game.tickIncome(); /* eslint-disable-next-line */ }, []);

  return (
    <div className="tr" style={{ ["--acc" as any]: accent }}>
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="tr-bg"><PolyScene className="tr-scene" /></div>
      <div className="tr-shade" />

      <div className="tr-top">
        <button className="tr-back" onClick={onBack}>← HQ</button>
        <div className="tr-title">TRADE</div>
        <div className="tr-money">{randMoney(Math.floor(game.money))}</div>
      </div>

      <div className="tr-wrap">
        <div className="tr-summary">
          <div><span>TRADE INCOME</span><b style={{ color: "#4fd190" }}>+{randMoney(game.tradeIncome)}/mo</b></div>
          <div><span>TOTAL INCOME</span><b style={{ color: accent }}>{randMoney(game.incomePerHour)}/mo</b></div>
          <div className="tr-blurb">Establish routes for steady money. Each upgrade adds permanent income — but the next level costs more.</div>
        </div>

        <div className="tr-list">
          {ROUTES.map((r) => {
            const lvl = game.trade?.[r.id] || 0;
            const locked = !!r.reqTerritory && terr < r.reqTerritory;
            const maxed = lvl >= TRADE_MAX;
            const cost = routeCost(r.id, lvl);
            const afford = game.money >= cost;
            return (
              <div key={r.id} className={"tr-card" + (locked ? " locked" : "")}>
                <div className="tr-icon">{r.icon}</div>
                <div className="tr-main">
                  <div className="tr-head">
                    <span className="tr-name">{r.name}</span>
                    <span className="tr-inc">{lvl > 0 ? `+${randShort(routeIncome(r.id, lvl))}/mo` : "inactive"}</span>
                  </div>
                  <div className="tr-desc">{r.desc}</div>
                  <div className="tr-pips">
                    {Array.from({ length: TRADE_MAX }).map((_, i) => <i key={i} className={i < lvl ? "on" : ""} />)}
                  </div>
                </div>
                <div className="tr-action">
                  {locked ? (
                    <div className="tr-lock">🔒 Hold {r.reqTerritory} regions</div>
                  ) : maxed ? (
                    <div className="tr-maxed">MAX</div>
                  ) : (
                    <button className="tr-btn" disabled={!afford} onClick={() => game.upgradeRoute(r.id)}>
                      <span>{lvl === 0 ? "Establish" : "Upgrade"}</span>
                      <b>{randShort(cost)}</b>
                      <em>+{randShort(r.baseIncome)}/mo</em>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

const CSS = `
.tr { position: fixed; inset: 0; z-index: 25; overflow-y: auto; color: #e9eef7;
  font-family: 'Oswald', system-ui, sans-serif; background: #070b12;
  --fill: #0e1826;
  --cham: polygon(0 8px, 8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px));
  --chamS: polygon(0 4px, 4px 0, calc(100% - 4px) 0, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0 calc(100% - 4px)); }
.tr-bg { position: fixed; inset: 0; z-index: 0; }
.tr-scene { position: absolute; inset: 0; }
.tr-shade { position: fixed; inset: 0; z-index: 1; pointer-events: none; background: linear-gradient(180deg, rgba(7,11,18,.78), rgba(7,11,18,.93)); }

.tr-top { position: sticky; top: 0; z-index: 4; display: flex; align-items: center; gap: 12px; padding: 14px 22px;
  background: linear-gradient(180deg, rgba(7,11,18,.96), rgba(7,11,18,.55)); }
.tr-back { cursor: pointer; font-family: 'Space Grotesk', monospace; font-size: 12px; letter-spacing: 1px; color: #aebbd2; background: var(--fill); clip-path: var(--chamS); padding: 8px 14px; border: none; }
.tr-back:hover { color: #fff; }
.tr-title { flex: 1; font-size: 20px; font-weight: 700; letter-spacing: 4px; }
.tr-money { font-family: 'Space Grotesk', monospace; color: #f0c860; font-size: 15px; }

.tr-wrap { position: relative; z-index: 2; max-width: 760px; margin: 0 auto; padding: 16px 22px 60px; }
.tr-summary { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; background: var(--fill); clip-path: var(--cham); padding: 16px; margin-bottom: 16px; }
.tr-summary > div span { display: block; font-size: 10px; letter-spacing: 2px; color: #8194b4; font-family: 'Space Grotesk', monospace; margin-bottom: 3px; }
.tr-summary > div b { font-size: 22px; font-family: 'Space Grotesk', monospace; }
.tr-blurb { grid-column: 1 / -1; font-size: 12.5px; color: #9fb0cc; font-weight: 300; line-height: 1.5; margin-top: 4px; }

.tr-list { display: flex; flex-direction: column; gap: 10px; }
.tr-card { display: flex; align-items: center; gap: 14px; background: var(--fill); clip-path: var(--cham); padding: 14px 16px; }
.tr-card.locked { opacity: .55; }
.tr-icon { font-size: 30px; width: 50px; height: 50px; flex-shrink: 0; display: flex; align-items: center; justify-content: center;
  background: rgba(86,185,207,.08); clip-path: var(--chamS); }
.tr-main { flex: 1; min-width: 0; }
.tr-head { display: flex; align-items: baseline; gap: 10px; }
.tr-name { font-size: 16px; font-weight: 600; }
.tr-inc { font-family: 'Space Grotesk', monospace; font-size: 12px; color: #4fd190; }
.tr-desc { font-size: 12px; color: #93a2bd; font-weight: 300; margin: 3px 0 8px; line-height: 1.4; }
.tr-pips { display: flex; gap: 5px; }
.tr-pips i { width: 22px; height: 6px; background: rgba(150,180,225,.14); clip-path: polygon(3px 0,100% 0,calc(100% - 3px) 100%,0 100%); }
.tr-pips i.on { background: var(--acc); }
.tr-action { flex-shrink: 0; }
.tr-btn { cursor: pointer; display: flex; flex-direction: column; align-items: center; gap: 1px; border: none; clip-path: var(--cham);
  background: linear-gradient(180deg, #f4d98a, #e0b94e); color: #06222b; padding: 10px 16px; min-width: 104px; font-family: 'Oswald'; }
.tr-btn span { font-size: 12px; font-weight: 600; letter-spacing: .5px; }
.tr-btn b { font-size: 16px; font-weight: 700; font-family: 'Space Grotesk', monospace; }
.tr-btn em { font-size: 10px; font-style: normal; opacity: .7; }
.tr-btn:disabled { background: #232c39; color: #6b7a98; cursor: default; }
.tr-lock, .tr-maxed { font-family: 'Space Grotesk', monospace; font-size: 12px; color: #6b7a98; text-align: center; min-width: 104px; }
.tr-maxed { color: #4fd190; font-weight: 700; letter-spacing: 2px; }

@media (max-width: 560px) {
  .tr-card { flex-wrap: wrap; }
  .tr-action { width: 100%; }
  .tr-btn, .tr-lock, .tr-maxed { width: 100%; flex-direction: row; justify-content: center; gap: 8px; }
}
`;
