"use client";
import { useMemo, useState } from "react";
import PolyScene from "@/components/PolyScene";
import UnitArt from "@/components/UnitArt";
import { useGame } from "@/lib/store";
import { UNITS, CATALOG, fmt } from "@/lib/catalog";
import { randMoney, randShort } from "@/lib/economy";
import { unitPower, recruitPrice, unitReqRank, RANKS } from "@/lib/campaign";
import { NATION } from "@/lib/nations";

/**
 * Barracks — regiment dossier + recruitment. components/Barracks.tsx
 * Left: featured unit showcase. Right: tabbed Recruit / Roster.
 * Props: onBack
 */
const RARITY_COLOR: Record<string, string> = {
  common: "#8da0bf", uncommon: "#4fd190", rare: "#56b9cf", elite: "#9b8cff", epic: "#9b8cff", legendary: "#f0c860",
};

export default function Barracks({ onBack }: { onBack?: () => void }) {
  const game = useGame();
  const accent = (game.nation && NATION[game.nation]?.accent) || "#56b9cf";
  const [tab, setTab] = useState<"recruit" | "roster">("recruit");
  // generic units + this nation's signature unit (hide other nations' specials)
  const roster = useMemo(() => UNITS.filter((u) => !u.nation || u.nation === game.nation), [game.nation]);
  const [featId, setFeatId] = useState<string>(roster[0].id);

  const f = CATALOG[featId];
  const max = useMemo(() => ({
    atk: Math.max(...UNITS.map((u) => u.atk)),
    hp: Math.max(...UNITS.map((u) => u.hp)),
    size: Math.max(...UNITS.map((u) => u.maxTroops)),
    pow: Math.max(...UNITS.map((u) => unitPower(u.id, u.maxTroops))),
  }), []);

  const fPrice = game.recruitCost(f.id);
  const fPow = unitPower(f.id, f.maxTroops);
  const fOwned = game.collection.filter((u) => u.defId === f.id).length;
  const rarCol = RARITY_COLOR[f.rarity] || "#8da0bf";

  const Stat = ({ label, val, frac, col }: { label: string; val: string; frac: number; col?: string }) => (
    <div className="bk-stat">
      <div className="bk-statTop"><span>{label}</span><b>{val}</b></div>
      <div className="bk-meter"><i style={{ width: `${Math.min(100, frac * 100)}%`, background: col || "var(--fa)" }} /></div>
    </div>
  );

  return (
    <div className="bk" style={{ ["--acc" as any]: accent }}>
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="bk-bg"><PolyScene className="bk-scene" /></div>
      <div className="bk-shade" />

      <div className="bk-top">
        <button className="bk-back" onClick={onBack}>← HQ</button>
        <div className="bk-title">BARRACKS</div>
        <div className="bk-res">
          <span className="bk-money">{randMoney(Math.floor(game.money))}</span>
          <span className="bk-supp">◆ {fmt(game.supplies)}</span>
        </div>
      </div>

      <div className="bk-main">
        {/* ===== FEATURED DOSSIER ===== */}
        <aside className="bk-feature" style={{ ["--fa" as any]: f.accent }}>
          <div className="bk-fStage">
            <span className="bk-fWatermark">{f.kind}</span>
            <UnitArt id={f.id} kind={f.kind} side="P" className="bk-fImg" />
            <span className="bk-rar" style={{ color: rarCol, borderColor: rarCol }}>{f.rarity}</span>
            {fOwned > 0 && <span className="bk-fOwned">{fOwned} in service</span>}
          </div>
          <div className="bk-fBody">
            <div className="bk-fName">{f.name}</div>
            <div className="bk-fRole">{f.branch} · {f.role}</div>
            <p className="bk-fBlurb">{f.blurb}</p>
            <div className="bk-stats">
              <Stat label="ATTACK" val={`${f.atk}`} frac={f.atk / max.atk} />
              <Stat label="RESILIENCE" val={`${f.hp}`} frac={f.hp / max.hp} />
              <Stat label="REGIMENT" val={fmt(f.maxTroops)} frac={f.maxTroops / max.size} />
              <Stat label="COMBAT POWER" val={fmt(fPow)} frac={fPow / max.pow} col="var(--acc)" />
            </div>
            {(() => {
              const req = unitReqRank(f.id); const locked = req > game.rank.index;
              return (
                <button className="bk-recruit" disabled={locked || game.money < fPrice} onClick={() => game.recruit(f.id)}>
                  {locked ? <>🔒 Requires {RANKS[req].name}</> : game.money < fPrice ? <>Need {randShort(fPrice)}</> : <>Recruit regiment · {randMoney(fPrice)}</>}
                </button>
              );
            })()}
          </div>
        </aside>

        {/* ===== RIGHT: tabs ===== */}
        <section className="bk-side">
          <div className="bk-tabs">
            <button className={"bk-tab" + (tab === "recruit" ? " on" : "")} onClick={() => setTab("recruit")}>Recruit</button>
            <button className={"bk-tab" + (tab === "roster" ? " on" : "")} onClick={() => setTab("roster")}>
              Your Regiments <em>{game.collection.length}</em>
            </button>
            {tab === "roster" && <button className="bk-allBtn" onClick={game.reinforceAll}>Reinforce all</button>}
          </div>

          {tab === "recruit" && (
            <div className="bk-grid">
              {roster.map((d) => {
                const price = game.recruitCost(d.id); const afford = game.money >= price;
                const req = unitReqRank(d.id); const locked = req > game.rank.index;
                return (
                  <button key={d.id} className={"bk-tile" + (featId === d.id ? " sel" : "") + (locked ? " lock" : "")}
                    style={{ ["--ta" as any]: d.accent }} onClick={() => setFeatId(d.id)}>
                    <div className="bk-tImg"><UnitArt id={d.id} kind={d.kind} side="P" className="bk-img" />{locked && <span className="bk-lock">🔒</span>}</div>
                    <div className="bk-tName">{d.name}</div>
                    <div className={"bk-tPrice" + (afford ? "" : " no")}>{locked ? RANKS[req].name : randShort(price)}</div>
                  </button>
                );
              })}
            </div>
          )}

          {tab === "roster" && (
            <div className="bk-roster">
              {game.collection.map((u) => {
                const c = CATALOG[u.defId]; const mx = c.maxTroops;
                const cost = game.reinforceCost(u);
                const full = u.troops >= mx; const wiped = u.troops <= 0;
                const afford = game.supplies >= cost;
                return (
                  <div key={u.uid} className={"bk-reg" + (wiped ? " wiped" : "")} style={{ ["--ra" as any]: c.accent }}>
                    <button className="bk-regThumb" onClick={() => { setFeatId(u.defId); setTab("recruit"); }}>
                      <UnitArt id={u.defId} kind={c.kind} side="P" className="bk-img" />
                    </button>
                    <div className="bk-regMain">
                      <div className="bk-regTop"><span className="bk-regName">{c.name}{(u.vet || 0) > 0 && <span className="bk-vet"> {"★".repeat(u.vet || 0)}</span>}</span><span className="bk-regPow">⚔ {fmt(Math.round(unitPower(u.defId, u.troops) * (1 + Math.min(5, u.vet || 0) * 0.12)))}</span></div>
                      <div className="bk-meter"><i style={{ width: `${Math.max(0, (u.troops / mx) * 100)}%`, background: wiped ? "#e5414f" : "var(--acc)" }} /></div>
                      <div className="bk-regSub">{fmt(u.troops)} / {fmt(mx)}{wiped && <b style={{ color: "#e5414f" }}> · WIPED</b>}</div>
                    </div>
                    <button className="bk-reBtn" disabled={full || !afford} onClick={() => game.reinforce(u.uid)}>{full ? "Full" : <>◆&nbsp;{fmt(cost)}</>}</button>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

const CSS = `
.bk { position: fixed; inset: 0; z-index: 25; overflow-y: auto; color: #e9eef7;
  font-family: 'Oswald', system-ui, sans-serif; background: #070b12;
  --fill: #0e1826;
  --cham: polygon(0 9px, 9px 0, calc(100% - 9px) 0, 100% 9px, 100% calc(100% - 9px), calc(100% - 9px) 100%, 9px 100%, 0 calc(100% - 9px));
  --chamS: polygon(0 4px, 4px 0, calc(100% - 4px) 0, 100% 4px, 100% calc(100% - 4px), calc(100% - 4px) 100%, 4px 100%, 0 calc(100% - 4px)); }
.bk-bg { position: fixed; inset: 0; z-index: 0; }
.bk-scene { position: absolute; inset: 0; }
.bk-shade { position: fixed; inset: 0; z-index: 1; pointer-events: none; background: linear-gradient(180deg, rgba(7,11,18,.82), rgba(7,11,18,.94)); }

.bk-top { position: sticky; top: 0; z-index: 5; display: flex; align-items: center; gap: 12px; padding: 14px 24px;
  background: linear-gradient(180deg, rgba(7,11,18,.97), rgba(7,11,18,.6)); }
.bk-back { cursor: pointer; font-family: 'Space Grotesk', monospace; font-size: 12px; letter-spacing: 1px; color: #aebbd2; background: var(--fill); clip-path: var(--chamS); padding: 8px 14px; border: none; }
.bk-back:hover { color: #fff; }
.bk-title { flex: 1; font-size: 20px; font-weight: 700; letter-spacing: 4px; }
.bk-res { display: flex; gap: 10px; font-family: 'Space Grotesk', monospace; font-size: 14px; }
.bk-money { color: #f0c860; } .bk-supp { color: #cfe0ea; }

.bk-main { position: relative; z-index: 2; max-width: 1320px; margin: 0 auto; padding: 18px 24px 70px;
  display: grid; grid-template-columns: 380px 1fr; gap: 20px; align-items: start; }

.bk-img { width: 100%; height: 100%; object-fit: contain; display: block; filter: drop-shadow(0 8px 9px rgba(0,0,0,.55)); }
.bk-meter { height: 7px; background: rgba(150,180,225,.12); overflow: hidden; }
.bk-meter i { display: block; height: 100%; transition: width .35s ease; }

/* ===== featured dossier ===== */
.bk-feature { position: sticky; top: 76px; background: var(--fa); clip-path: var(--cham); }
.bk-feature::before { content: ""; position: absolute; inset: 2px; background: #0d1622; clip-path: var(--cham); z-index: 0; }
.bk-fStage { position: relative; z-index: 1; height: 300px; padding: 16px 16px 0; display: flex; align-items: center; justify-content: center;
  background: radial-gradient(58% 60% at 50% 44%, color-mix(in srgb, var(--fa) 38%, transparent), transparent 72%); }
.bk-fWatermark { position: absolute; bottom: 6px; left: 0; right: 0; text-align: center; font-size: 64px; font-weight: 700;
  letter-spacing: 6px; text-transform: uppercase; color: rgba(255,255,255,.04); pointer-events: none; line-height: 1; }
.bk-fImg { position: relative; z-index: 1; max-width: 78%; max-height: 280px; object-fit: contain; filter: drop-shadow(0 14px 16px rgba(0,0,0,.6)); }
.bk-rar { position: absolute; top: 14px; left: 14px; z-index: 2; font-family: 'Space Grotesk', monospace; font-size: 10px; letter-spacing: 2px;
  text-transform: uppercase; border: 1px solid; clip-path: var(--chamS); padding: 3px 9px; background: rgba(0,0,0,.4); }
.bk-fOwned { position: absolute; top: 14px; right: 14px; z-index: 2; font-family: 'Space Grotesk', monospace; font-size: 10px; letter-spacing: 1px;
  color: #06222b; background: var(--acc); clip-path: var(--chamS); padding: 3px 9px; }
.bk-fBody { position: relative; z-index: 1; padding: 4px 20px 20px; }
.bk-fName { font-size: 26px; font-weight: 700; letter-spacing: .5px; line-height: 1.05; }
.bk-fRole { font-family: 'Space Grotesk', monospace; font-size: 11px; letter-spacing: 2px; color: var(--fa); text-transform: uppercase; margin-top: 4px; }
.bk-fBlurb { font-size: 13px; color: #aab9d2; font-weight: 300; line-height: 1.5; margin: 12px 0 16px; }
.bk-stats { display: flex; flex-direction: column; gap: 11px; margin-bottom: 18px; }
.bk-statTop { display: flex; justify-content: space-between; font-family: 'Space Grotesk', monospace; font-size: 11px; margin-bottom: 5px; }
.bk-statTop span { color: #8194b4; letter-spacing: 1px; } .bk-statTop b { color: #e9eef7; }
.bk-recruit { width: 100%; cursor: pointer; font-family: 'Oswald'; font-weight: 700; font-size: 16px; letter-spacing: 1px; color: #06222b;
  background: linear-gradient(180deg, #f4d98a, #e0b94e); border: none; clip-path: var(--cham); padding: 14px; }
.bk-recruit:disabled { background: #232c39; color: #6b7a98; cursor: default; }

/* ===== right side ===== */
.bk-side { min-width: 0; }
.bk-tabs { display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
.bk-tab { cursor: pointer; font-family: 'Oswald'; font-weight: 600; font-size: 15px; letter-spacing: 1px; color: #93a2bd;
  background: var(--fill); clip-path: var(--chamS); padding: 10px 16px; border: none; }
.bk-tab.on { color: #06222b; background: var(--acc); }
.bk-tab em { font-style: normal; font-family: 'Space Grotesk', monospace; font-size: 11px; opacity: .8; margin-left: 4px; }
.bk-allBtn { margin-left: auto; cursor: pointer; font-family: 'Oswald'; font-weight: 600; font-size: 13px; letter-spacing: 1px; color: #06222b;
  background: linear-gradient(180deg, #74cee0, #3f9fb8); border: none; clip-path: var(--chamS); padding: 9px 16px; }

.bk-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; }
.bk-tile { position: relative; cursor: pointer; text-align: left; border: none; padding: 0; background: #141e2c; clip-path: var(--cham);
  transition: transform .13s, filter .15s; color: #e9eef7; }
.bk-tile:hover { transform: translateY(-3px); filter: brightness(1.06); }
.bk-tile.sel { background: var(--ta); }
.bk-tile.sel::before { content: ""; position: absolute; inset: 2px; background: #141e2c; clip-path: var(--cham); z-index: 0; }
.bk-tile > * { position: relative; z-index: 1; }
.bk-tImg { aspect-ratio: 1 / 1; background: radial-gradient(58% 58% at 50% 44%, color-mix(in srgb, var(--ta) 26%, transparent), transparent 72%); padding: 8px 8px 0; position: relative; }
.bk-tile.lock { opacity: .72; }
.bk-tile.lock .bk-img { filter: grayscale(.7) brightness(.7); }
.bk-lock { position: absolute; top: 6px; right: 6px; font-size: 14px; filter: drop-shadow(0 1px 2px #000); }
.bk-vet { color: #f0c860; font-size: 11px; letter-spacing: 1px; }
.bk-tName { padding: 6px 10px 0; font-size: 13px; font-weight: 600; line-height: 1.15; }
.bk-tPrice { padding: 2px 10px 10px; font-family: 'Space Grotesk', monospace; font-size: 12px; color: #f0c860; }
.bk-tPrice.no { color: #6b7a98; }

.bk-roster { display: grid; grid-template-columns: repeat(auto-fill, minmax(330px, 1fr)); gap: 10px; }
.bk-reg { display: flex; align-items: center; gap: 12px; background: var(--fill); clip-path: var(--cham); padding: 10px 14px 10px 10px; }
.bk-reg.wiped { opacity: .68; }
.bk-regThumb { width: 60px; height: 74px; flex-shrink: 0; cursor: pointer; border: none; padding: 4px; clip-path: var(--chamS); overflow: hidden;
  background: radial-gradient(70% 60% at 50% 40%, color-mix(in srgb, var(--ra) 24%, transparent), transparent 72%), #0b121c; }
.bk-regMain { flex: 1; min-width: 0; }
.bk-regTop { display: flex; justify-content: space-between; gap: 8px; }
.bk-regName { font-size: 15px; font-weight: 600; } .bk-regPow { font-family: 'Space Grotesk', monospace; font-size: 12px; color: var(--acc); white-space: nowrap; }
.bk-meter + .bk-regSub, .bk-regMain .bk-meter { margin: 7px 0 4px; }
.bk-regSub { font-family: 'Space Grotesk', monospace; font-size: 11px; color: #8da0bf; }
.bk-reBtn { cursor: pointer; font-family: 'Space Grotesk', monospace; font-size: 13px; color: #cfe0ea; background: rgba(86,185,207,.14); clip-path: var(--chamS); padding: 12px 14px; border: none; min-width: 76px; flex-shrink: 0; }
.bk-reBtn:disabled { opacity: .4; cursor: default; }

@media (max-width: 860px) {
  .bk-main { grid-template-columns: 1fr; }
  .bk-feature { position: static; }
  .bk-roster { grid-template-columns: 1fr; }
}
@media (max-width: 460px) { .bk-grid { grid-template-columns: 1fr 1fr; } }
`;
