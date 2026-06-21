"use client";
import UnitArt from "@/components/UnitArt";
import { CATALOG, RARITY, fmt } from "@/lib/catalog";
import { OwnedUnit, useGame } from "@/lib/store";

export default function CollectionCard({ unit }: { unit: OwnedUnit }) {
  const def = CATALOG[unit.defId];
  const rar = RARITY[def.rarity];
  const { reinforce, reinforceCost, supplies } = useGame();

  const pct = Math.max(0, Math.min(100, (unit.troops / def.maxTroops) * 100));
  const lost = unit.troops <= 0;
  const cost = reinforceCost(unit);
  const canReinforce = cost > 0 && supplies >= cost;
  const lowColor = pct > 50 ? "#7fb069" : pct > 20 ? "#e0b24a" : "#d6473f";

  return (
    <div className={"ccard" + (lost ? " routed" : "")} style={{ borderColor: rar.color }}>
      <div className="uscene">
        <div className="grainOverlay" />
        <div className="ushadow" />
        <div className="uart"><UnitArt id={def.id} kind={def.kind} size={92} /></div>
        <div className="rarpip" style={{ background: rar.color }}>{rar.label}</div>
        {lost && <div className="routedTag">ROUTED</div>}
      </div>

      <div className="uplate">
        <div className="uname">{def.name}</div>
        <div className="ubadges"><span>{def.branch}</span><span style={{ opacity: .5 }}>·</span><span>{def.role}</span></div>

        {/* regiment troop bar */}
        <div className="troopline">
          <span className="lbl" style={{ letterSpacing: 1 }}>TROOPS</span>
          <span style={{ fontFamily: "var(--mono)", fontWeight: 700, color: lowColor }}>{fmt(unit.troops)}<span style={{ color: "var(--faint)" }}>/{fmt(def.maxTroops)}</span></span>
        </div>
        <div className="troopbar"><div style={{ width: pct + "%", background: `linear-gradient(90deg, ${lowColor}, ${lowColor})` }} /></div>

        <div className="ustats" style={{ marginTop: 7 }}>
          <span style={{ color: "var(--crimson)" }}>ATK {def.atk}</span>
          <span style={{ color: "#7fb069" }}>DEF {def.hp}</span>
        </div>

        <button className="btn reinforce" disabled={!canReinforce} onClick={() => reinforce(unit.uid)}>
          {cost <= 0 ? "At full strength" : <>Reinforce <span style={{ color: "var(--brass)" }}>◆ {cost}</span></>}
        </button>
      </div>
    </div>
  );
}
