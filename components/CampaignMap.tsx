"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useGame, MapNode, NodeType } from "@/lib/store";

const ROW_H = 94, PAD_X = 46, PAD_Y = 58;
const TYPE: Record<NodeType, { color: string; label: string }> = {
  battle:  { color: "#8aa0c8", label: "Sector" },
  elite:   { color: "#b07cff", label: "Strongpoint" },
  supply:  { color: "#f0c860", label: "Supply depot" },
  recruit: { color: "#56b9cf", label: "Reinforcements" },
  boss:    { color: "#e5414f", label: "Salient" },
};

function NodeIcon({ type, color }: { type: NodeType; color: string }) {
  const s = { stroke: color, strokeWidth: 2.2, fill: "none", strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  return (
    <svg viewBox="0 0 24 24">
      {type === "battle" && <g {...s}><path d="M5 19 L19 5 M16 5 L19 5 L19 8 M5 16 L5 19 L8 19" /><path d="M19 19 L5 5" /></g>}
      {type === "elite" && <g {...s}><path d="M12 3 L14.5 9.5 L21 12 L14.5 14.5 L12 21 L9.5 14.5 L3 12 L9.5 9.5 Z" /></g>}
      {type === "supply" && <g {...s}><rect x="5" y="6" width="14" height="13" rx="1.5" /><path d="M5 11 H19 M12 6 V19" /></g>}
      {type === "recruit" && <g {...s}><circle cx="12" cy="12" r="8" /><path d="M12 8 V16 M8 12 H16" /></g>}
      {type === "boss" && <g {...s}><path d="M12 3 C7 3 4 6 4 11 C4 14 6 15 6 17 L6 19 L18 19 L18 17 C18 15 20 14 20 11 C20 6 17 3 12 3 Z" /><circle cx="9" cy="11" r="1.4" fill={color} stroke="none" /><circle cx="15" cy="11" r="1.4" fill={color} stroke="none" /></g>}
    </svg>
  );
}

export default function CampaignMap() {
  const game = useGame();
  const scroller = useRef<HTMLDivElement>(null);
  const [w, setW] = useState(360);

  useLayoutEffect(() => {
    const el = scroller.current; if (!el) return;
    const update = () => setW(el.clientWidth);
    update();
    const ro = new ResizeObserver(update); ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // auto-scroll to the next objective (hook stays above any early return)
  useEffect(() => {
    const el = scroller.current; if (!el || !game.map) return;
    const m = game.map;
    const h = (m.rows - 1) * ROW_H + PAD_Y * 2;
    const targetRow = game.available.length
      ? Math.min(...game.available.map((id) => m.nodes.find((n) => n.id === id)!.row))
      : 0;
    const y = h - PAD_Y - targetRow * ROW_H;
    el.scrollTo({ top: Math.max(0, y - el.clientHeight / 2), behavior: "smooth" });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [game.position, w, game.map]);

  if (!game.map) return <div className="stub z"><div className="stubt">PREPARING THE FRONT…</div></div>;

  const { nodes, rows, regions } = game.map;
  const height = (rows - 1) * ROW_H + PAD_Y * 2;
  const yOf = (row: number) => height - PAD_Y - row * ROW_H;     // row 0 at the bottom
  const xOf = (x: number) => PAD_X + x * (w - PAD_X * 2);
  const byId = (id: string) => nodes.find((n) => n.id === id)!;

  const isCleared = (id: string) => game.cleared.includes(id);
  const isAvail = (id: string) => game.available.includes(id);
  const isCurrent = (id: string) => game.position === id;

  return (
    <div className="z">
      <div className="maphint">
        <div style={{ fontSize: 14, color: "var(--sub)" }}>
          {game.available.length ? "Choose your next objective —" : "Front secured."} <b style={{ color: "var(--steel)" }}>{game.available.length ? byId(game.available[0]).region : ""}</b>
        </div>
        <div className="mlegend">
          {(["battle", "elite", "supply", "recruit", "boss"] as NodeType[]).map((t) => (
            <span key={t}><i className="mdot" style={{ background: TYPE[t].color }} />{TYPE[t].label}</span>
          ))}
        </div>
      </div>

      <div className="mapscroll" ref={scroller} style={{ maxHeight: "72vh" }}>
        <div className="map" style={{ height }}>
          {/* edges */}
          <svg className="medge" viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none">
            {nodes.map((n) => n.next.map((nid) => {
              const t = byId(nid);
              const hot = (isCleared(n.id) && isCleared(t.id)) || (isCurrent(n.id) && isAvail(t.id)) || (!game.position && n.row === 0 && isAvail(t.id));
              return <line key={n.id + nid} x1={xOf(n.x)} y1={yOf(n.row)} x2={xOf(t.x)} y2={yOf(t.row)}
                stroke={hot ? "#56b9cf" : "rgba(150,180,225,.16)"} strokeWidth={hot ? 2.5 : 1.5} strokeDasharray={hot ? "" : "4 5"} />;
            }))}
          </svg>

          {/* region bands */}
          {regions.map((rg, i) => {
            const row = i * 3;
            return <div key={rg} className="regionband" style={{ top: yOf(row) + ROW_H / 2 }}><span className="regionlabel">{rg.toUpperCase()}</span></div>;
          })}

          {/* nodes */}
          {nodes.map((n) => {
            const cleared = isCleared(n.id), avail = isAvail(n.id), current = isCurrent(n.id);
            const cls = "mnode " + (current ? "current" : cleared ? "cleared" : avail ? "avail" : "locked");
            const col = TYPE[n.type].color;
            return (
              <div key={n.id} className={cls} title={`${TYPE[n.type].label} · ${n.region}`}
                style={{ left: xOf(n.x), top: yOf(n.row), borderColor: current || avail ? col : "rgba(150,180,225,.2)" }}
                onClick={() => avail && game.selectNode(n.id)}>
                <NodeIcon type={n.type} color={cleared && !current ? "#6f7d97" : col} />
              </div>
            );
          })}
        </div>
      </div>

      {game.notice && <div className="toast">{game.notice}</div>}
    </div>
  );
}
