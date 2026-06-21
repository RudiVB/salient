"use client";
import { useState } from "react";
import { NATIONS, NATION, ALLIANCES } from "@/lib/nations";
import { Flag } from "@/components/Flag";
import PolyScene from "@/components/PolyScene";

/**
 * NationSelect — pick a 1916 great power (two-pane: roster + detail).
 * components/NationSelect.tsx
 * Props: onConfirm(id), onBack?
 */

const DIFF_COLOR: Record<string, string> = { Medium: "#56b9cf", Hard: "#f0c860", Expert: "#e5414f" };
const PERK_ICON: Record<string, string> = { assault: "⚔", armor: "🛡", artillery: "🎯", numbers: "👥", defense: "🏰", supply: "⛟", mobility: "🐎" };
const STATS: [keyof typeof NATIONS[0]["stats"], string][] = [["inf", "Infantry"], ["arm", "Armour"], ["art", "Artillery"], ["man", "Manpower"], ["sup", "Supply"]];

export default function NationSelect({ onConfirm, onBack }: { onConfirm?: (id: string) => void; onBack?: () => void }) {
  const [sel, setSel] = useState<string>(NATIONS[0].id);
  const n = NATION[sel];

  return (
    <div className="nsx">
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="nsx-bg"><PolyScene className="nsx-scene" /></div>
      <div className="nsx-shade" />

      <div className="nsx-top">
        {onBack && <button className="nsx-back" onClick={onBack}>← Menu</button>}
        <div className="nsx-kicker">1916 · CHOOSE YOUR NATION</div>
        <h1 className="nsx-title">TAKE COMMAND</h1>
        <div className="nsx-sub">Each power fights differently. Your objective is the same: <b>take the world.</b></div>
      </div>

      <div className="nsx-wrap">
        {/* ROSTER */}
        <div className="nsx-list">
          {ALLIANCES.map((al) => (
            <div className="nsx-group" key={al}>
              <div className="nsx-groupHead">{al === "Allied" ? "◆ ALLIED POWERS" : "◆ CENTRAL POWERS"}</div>
              {NATIONS.filter((x) => x.alliance === al).map((x) => (
                <button key={x.id} className={"nsx-row" + (sel === x.id ? " on" : "")}
                  onClick={() => setSel(x.id)}
                  style={sel === x.id ? { background: x.accent, boxShadow: `0 0 18px -2px ${x.accent}` } : undefined}>
                  <Flag id={x.id} className="nsx-flag-sm" />
                  <div className="nsx-rowText">
                    <div className="nsx-rowName">{x.name}</div>
                    <div className="nsx-rowPerk">{x.perkTitle}</div>
                  </div>
                  <span className="nsx-diffDot" style={{ background: DIFF_COLOR[x.difficulty] }} title={x.difficulty} />
                </button>
              ))}
            </div>
          ))}
        </div>

        {/* DETAIL */}
        <div className="nsx-detail" style={{ ["--acc" as any]: n.accent }}>
          <div className="nsx-flagWrap">
            <Flag id={n.id} className="nsx-flag-lg" />
          </div>

          <div className="nsx-dHead">
            <h2 className="nsx-dName">{n.name}</h2>
            <span className="nsx-diff" style={{ color: DIFF_COLOR[n.difficulty], borderColor: DIFF_COLOR[n.difficulty] }}>{n.difficulty}</span>
            <span className="nsx-alliance">{n.alliance === "Allied" ? "Allied" : "Central"}</span>
          </div>
          <div className="nsx-meta">👑 {n.leader}　·　🏛 {n.capital}</div>
          <p className="nsx-note">{n.note}</p>

          {/* doctrine */}
          <div className="nsx-perkBox">
            <span className="nsx-perkIcon">{PERK_ICON[n.perkKind]}</span>
            <div>
              <div className="nsx-perkTitle">{n.perkTitle}</div>
              <div className="nsx-perkDesc">{n.perk}</div>
            </div>
          </div>

          {/* strength bars */}
          <div className="nsx-stats">
            {STATS.map(([k, label]) => (
              <div className="nsx-stat" key={k}>
                <span className="nsx-statLabel">{label}</span>
                <span className="nsx-bar"><i style={{ width: `${(n.stats[k] / 5) * 100}%` }} /></span>
                <span className="nsx-statVal">{n.stats[k]}</span>
              </div>
            ))}
          </div>

          {/* signature + fronts */}
          <div className="nsx-info">
            <div className="nsx-infoRow"><span className="nsx-infoK">Signature</span><span className="nsx-infoV">{n.signature}</span></div>
            <div className="nsx-infoRow"><span className="nsx-infoK">Fronts</span>
              <span className="nsx-chips">{n.fronts.map((f) => <span key={f} className="nsx-chip">{f}</span>)}</span>
            </div>
          </div>

          <button className="nsx-go" onClick={() => onConfirm?.(n.id)}>Take command of {n.name} ▸</button>
        </div>
      </div>
    </div>
  );
}

const CSS = `
.nsx { position: fixed; inset: 0; z-index: 25; overflow-y: auto; color: #e9eef7;
  font-family: 'Oswald', system-ui, sans-serif; background: #070b12;
  --edge: rgba(140,175,215,.30); --fill: #0e1826;
  --cham: polygon(0 8px, 8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px));
  --chamR: polygon(0 0, calc(100% - 10px) 0, 100% 10px, 100% 100%, 10px 100%, 0 calc(100% - 10px));
  --chamS: polygon(0 4px, 4px 0, calc(100% - 4px) 0, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0 calc(100% - 4px)); }

/* 3D backdrop */
.nsx-bg { position: fixed; inset: 0; z-index: 0; }
.nsx-scene { position: absolute; inset: 0; }
.nsx-shade { position: fixed; inset: 0; z-index: 1; pointer-events: none;
  background: linear-gradient(180deg, rgba(7,11,18,.55) 0%, rgba(7,11,18,.35) 38%, rgba(7,11,18,.85) 100%); }

.nsx-top, .nsx-wrap { position: relative; z-index: 2; }

.nsx-top { text-align: center; padding: 34px 20px 10px; }
.nsx-back { position: absolute; left: 18px; top: 22px; cursor: pointer; font-family: 'Space Grotesk', monospace;
  font-size: 12px; letter-spacing: 1px; color: #aebbd2; background: var(--fill); clip-path: var(--chamS); padding: 8px 16px; border: none; }
.nsx-back:hover { color: #fff; background: #16243a; }
.nsx-kicker { font-family: 'Space Grotesk', monospace; font-size: 12px; letter-spacing: 5px; color: #f0c860; }
.nsx-title { margin: 8px 0 6px; font-size: clamp(28px, 6vw, 50px); font-weight: 700; letter-spacing: 5px;
  text-shadow: 0 2px 24px rgba(0,0,0,.7); }
.nsx-sub { max-width: 540px; margin: 0 auto; color: #aebbd2; font-size: 14px; font-weight: 300; }
.nsx-sub b { color: #56b9cf; font-weight: 600; }

.nsx-wrap { display: grid; grid-template-columns: 320px 1fr; gap: 18px; max-width: 1060px;
  margin: 18px auto 60px; padding: 0 18px; align-items: start; }

/* roster */
.nsx-list { display: flex; flex-direction: column; gap: 16px; }
.nsx-group { display: flex; flex-direction: column; gap: 9px; }
.nsx-groupHead { font-family: 'Space Grotesk', monospace; font-size: 10.5px; letter-spacing: 3px; color: #8194b4; padding: 0 4px 2px; }

.nsx-row { position: relative; display: flex; align-items: center; gap: 12px; cursor: pointer; text-align: left;
  background: var(--edge); clip-path: var(--chamR); padding: 10px 12px; color: #e9eef7; border: none;
  transition: transform .12s, background .15s; }
.nsx-row::before { content: ""; position: absolute; inset: 1.5px; background: var(--fill); clip-path: var(--chamR); z-index: 0; }
.nsx-row > * { position: relative; z-index: 1; }
.nsx-row:hover { transform: translateX(3px); }
.nsx-flag-sm { width: 42px; height: 28px; flex-shrink: 0; clip-path: var(--chamS);
  box-shadow: 0 2px 6px rgba(0,0,0,.5); }
.nsx-rowText { flex: 1; min-width: 0; }
.nsx-rowName { font-size: 15px; font-weight: 600; letter-spacing: .5px; }
.nsx-rowPerk { font-size: 11px; color: #9db0cf; font-family: 'Space Grotesk', monospace; letter-spacing: .5px; }
.nsx-diffDot { width: 9px; height: 9px; flex-shrink: 0; clip-path: polygon(50% 0, 100% 50%, 50% 100%, 0 50%);
  box-shadow: 0 0 8px currentColor; }

/* detail — faceted card with accent facet-border */
.nsx-detail { position: relative; background: var(--acc); clip-path: var(--cham); padding: 0 18px 18px;
  box-shadow: 0 26px 60px -28px #000; }
.nsx-detail::before { content: ""; position: absolute; inset: 2px; background: #0d1622; clip-path: var(--cham); z-index: 0; }
.nsx-detail > * { position: relative; z-index: 1; }

.nsx-flagWrap { margin: 0 -18px 16px; height: 150px; position: relative;
  clip-path: polygon(0 0, 100% 0, 100% calc(100% - 12px), calc(100% - 16px) 100%, 0 100%);
  border-bottom: 2px solid var(--acc); }
.nsx-flag-lg { width: 100%; height: 100%; display: block; }
.nsx-flagWrap::after { content: ""; position: absolute; inset: 0;
  box-shadow: inset 0 -44px 50px -20px rgba(8,12,20,.92); pointer-events: none; }

.nsx-dHead { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
.nsx-dName { margin: 0; font-size: clamp(22px, 4vw, 30px); font-weight: 700; letter-spacing: 1px; flex: 1 1 auto; }
.nsx-diff { font-family: 'Space Grotesk', monospace; font-size: 11px; letter-spacing: 1px; font-weight: 600;
  background: rgba(0,0,0,.35); clip-path: var(--chamS); padding: 4px 11px; color: var(--acc); }
.nsx-alliance { font-family: 'Space Grotesk', monospace; font-size: 11px; letter-spacing: 1px; color: #aebbd2;
  background: rgba(140,175,215,.12); clip-path: var(--chamS); padding: 4px 11px; }
.nsx-meta { color: #b6c3d8; font-size: 13px; margin: 9px 0 2px; }
.nsx-note { color: #9fb0cc; font-size: 13.5px; line-height: 1.55; font-weight: 300; margin: 10px 0 16px; }

.nsx-perkBox { position: relative; display: flex; gap: 12px; align-items: flex-start;
  background: var(--acc); clip-path: var(--cham); padding: 12px 14px; }
.nsx-perkBox::before { content: ""; position: absolute; inset: 1.5px; background: #111d2b; clip-path: var(--cham); z-index: 0; }
.nsx-perkBox > * { position: relative; z-index: 1; }
.nsx-perkIcon { font-size: 22px; line-height: 1; color: var(--acc); }
.nsx-perkTitle { font-weight: 700; font-size: 15px; letter-spacing: .5px; color: var(--acc); }
.nsx-perkDesc { font-size: 13px; color: #c3cfe2; font-weight: 300; margin-top: 3px; line-height: 1.45; }

/* segmented (blocky) strength bars */
.nsx-stats { display: flex; flex-direction: column; gap: 9px; margin: 18px 0; }
.nsx-stat { display: grid; grid-template-columns: 72px 1fr 16px; align-items: center; gap: 10px; }
.nsx-statLabel { font-size: 11.5px; color: #9db0cf; font-family: 'Space Grotesk', monospace; letter-spacing: .5px; }
.nsx-bar { position: relative; height: 12px; background: rgba(140,175,215,.10); overflow: hidden; }
.nsx-bar i { display: block; height: 100%; background: linear-gradient(90deg, var(--acc), #74cee0); transition: width .35s ease; }
.nsx-bar::after { content: ""; position: absolute; inset: 0; pointer-events: none;
  background: repeating-linear-gradient(90deg, transparent 0, transparent calc(20% - 2px), #0d1622 calc(20% - 2px), #0d1622 20%); }
.nsx-statVal { font-size: 12px; color: #c2cee2; text-align: right; font-family: 'Space Grotesk', monospace; }

.nsx-info { border-top: 1px solid rgba(140,175,215,.14); padding-top: 14px; margin-bottom: 18px; }
.nsx-infoRow { display: flex; gap: 12px; align-items: center; margin-bottom: 10px; }
.nsx-infoK { width: 72px; flex-shrink: 0; font-size: 11.5px; color: #9db0cf; font-family: 'Space Grotesk', monospace; letter-spacing: .5px; }
.nsx-infoV { font-size: 14px; color: #e6ecf6; }
.nsx-chips { display: flex; flex-wrap: wrap; gap: 6px; }
.nsx-chip { font-family: 'Space Grotesk', monospace; font-size: 10.5px; letter-spacing: 1px; color: #cfe3ea;
  background: rgba(86,185,207,.16); clip-path: var(--chamS); padding: 4px 10px; }

.nsx-go { width: 100%; cursor: pointer; font-family: 'Oswald', sans-serif; font-weight: 700; font-size: 16px; letter-spacing: 1px;
  color: #06222b; padding: 15px 18px; border: none; clip-path: var(--cham);
  background: linear-gradient(180deg, #74cee0, #3f9fb8); transition: transform .12s, filter .15s; }
.nsx-go:hover { transform: translateY(-2px); filter: brightness(1.1); }

@media (max-width: 860px) {
  .nsx-wrap { grid-template-columns: 1fr; gap: 14px; }
  .nsx-list { flex-direction: row; overflow-x: auto; gap: 8px; padding-bottom: 6px;
    scroll-snap-type: x mandatory; -webkit-overflow-scrolling: touch; }
  .nsx-group { display: contents; }
  .nsx-groupHead { display: none; }
  .nsx-row { flex-direction: column; min-width: 120px; text-align: center; scroll-snap-align: start; gap: 8px; }
  .nsx-row:hover { transform: none; }
  .nsx-rowText { width: 100%; }
  .nsx-rowName { font-size: 13px; }
  .nsx-diffDot { position: absolute; top: 8px; right: 8px; }
  .nsx-flag-sm { width: 64px; height: 42px; }
}
`;
