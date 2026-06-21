"use client";
import { useGame } from "@/lib/store";
import { NATION } from "@/lib/nations";
import { DOCTRINES, BRANCHES, DMAP } from "@/lib/doctrine";

/**
 * DoctrineScreen — the War Doctrine tech tree (Pillar 2).
 * components/DoctrineScreen.tsx · three branches of four nodes each.
 * Spend War Research (earned in battle) to unlock permanent army-wide bonuses.
 */
export default function DoctrineScreen({ onBack }: { onBack?: () => void }) {
  const game = useGame();
  const accent = (game.nation && NATION[game.nation]?.accent) || "#56b9cf";
  const owned = game.doctrines || [];
  const d = game.doctrine;

  // active-bonus summary chips
  const chips: { label: string; val: string }[] = [];
  if (d.powerMult > 1) chips.push({ label: "POWER", val: `+${Math.round((d.powerMult - 1) * 100)}%` });
  if (d.casualtyMult < 1) chips.push({ label: "CASUALTIES", val: `−${Math.round((1 - d.casualtyMult) * 100)}%` });
  if (d.winChanceAdd > 0) chips.push({ label: "WIN CHANCE", val: `+${d.winChanceAdd}%` });
  if (d.incomeMult > 1) chips.push({ label: "INCOME", val: `+${Math.round((d.incomeMult - 1) * 100)}%` });
  if (d.recruitDiscount > 0) chips.push({ label: "RECRUIT", val: `−${Math.round(d.recruitDiscount * 100)}%` });
  if (d.reinforceDiscount > 0) chips.push({ label: "REINFORCE", val: `−${Math.round(d.reinforceDiscount * 100)}%` });

  return (
    <div className="dc" style={{ ["--acc" as any]: accent }}>
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="dc-top">
        <button className="dc-back" onClick={onBack}>← HQ</button>
        <div className="dc-titles">
          <div className="dc-kick">WAR DOCTRINE</div>
          <div className="dc-name">Command Staff</div>
        </div>
        <div className="dc-rp"><span>WAR RESEARCH</span><b>🔬 {game.research}</b></div>
      </div>

      <div className="dc-sub">Earn War Research in battle — win <b>+3</b>, loss <b>+1</b>. Unlock nodes top to bottom.</div>

      {chips.length > 0 && (
        <div className="dc-active">
          {chips.map((c) => <div key={c.label} className="dc-aChip"><span>{c.label}</span><b>{c.val}</b></div>)}
        </div>
      )}

      <div className="dc-tree">
        {BRANCHES.map((br) => {
          const nodes = DOCTRINES.filter((n) => n.branch === br.id).sort((a, b) => a.tier - b.tier);
          return (
            <div key={br.id} className="dc-col" style={{ ["--bacc" as any]: br.accent }}>
              <div className="dc-colHead"><span className="dc-colIcon">{br.icon}</span><b>{br.name}</b><i>{br.blurb}</i></div>
              <div className="dc-chain">
                {nodes.map((n, idx) => {
                  const isOwned = owned.includes(n.id);
                  const prereqMet = !n.req || owned.includes(n.req);
                  const affordable = game.research >= n.cost;
                  const state = isOwned ? "owned" : !prereqMet ? "locked" : affordable ? "ready" : "need";
                  const linkOn = idx > 0 && owned.includes(nodes[idx - 1].id);
                  return (
                    <div key={n.id} className="dc-nodeWrap">
                      {idx > 0 && <div className={"dc-link" + (linkOn ? " on" : "")} />}
                      <button
                        className={"dc-node dc-" + state}
                        disabled={state !== "ready"}
                        onClick={() => game.researchDoctrine(n.id)}
                      >
                        <div className="dc-nIcon">{n.icon}</div>
                        <div className="dc-nBody">
                          <div className="dc-nName">{n.name}{isOwned && <span className="dc-chk">✓</span>}</div>
                          <div className="dc-nDesc">{n.desc}</div>
                        </div>
                        <div className="dc-nCost">
                          {isOwned ? <span className="dc-owned">OWNED</span>
                            : state === "locked" ? <span className="dc-lock">🔒</span>
                            : <span className={affordable ? "dc-can" : "dc-no"}>🔬 {n.cost}</span>}
                        </div>
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const CSS = `
.dc { position: fixed; inset: 0; z-index: 40; overflow-y: auto; color: #e9eef7; font-family: 'Space Grotesk', system-ui, sans-serif;
  background: radial-gradient(120% 90% at 50% 0%, #16263a 0%, #0b1320 55%, #070b12 100%); padding-bottom: 40px; }
.dc-top { display: flex; align-items: center; gap: 12px; padding: 14px 16px 8px; }
.dc-back { background: rgba(16,24,38,.85); border: 1px solid rgba(120,150,190,.3); color: #cfdaec; cursor: pointer; font-family: 'Oswald'; letter-spacing: 1px; padding: 8px 13px; font-size: 13px; white-space: nowrap;
  clip-path: polygon(0 5px,5px 0,100% 0,100% calc(100% - 5px),calc(100% - 5px) 100%,0 100%); }
.dc-back:hover { border-color: var(--acc); color: #fff; }
.dc-titles { flex: 1; min-width: 0; }
.dc-kick { font-size: 10px; letter-spacing: 2.5px; color: var(--acc); font-weight: 700; }
.dc-name { font-family: 'Oswald'; font-size: 21px; font-weight: 600; line-height: 1.05; }
.dc-rp { text-align: right; background: rgba(14,24,38,.7); border: 1px solid rgba(120,150,190,.22); padding: 6px 12px;
  clip-path: polygon(0 5px,5px 0,100% 0,100% calc(100% - 5px),calc(100% - 5px) 100%,0 100%); }
.dc-rp span { display: block; font-size: 8.5px; letter-spacing: 1.5px; color: #8294ad; }
.dc-rp b { font-family: 'Oswald'; font-size: 18px; color: #8fdcff; }
.dc-sub { padding: 0 16px 10px; font-size: 12px; color: #93a4bd; } .dc-sub b { color: #cfe0ea; }
.dc-active { display: flex; flex-wrap: wrap; gap: 7px; padding: 0 16px 12px; }
.dc-aChip { background: rgba(79,209,144,.1); border: 1px solid rgba(79,209,144,.3); padding: 4px 10px; border-radius: 5px; }
.dc-aChip span { font-size: 8.5px; letter-spacing: 1.2px; color: #8aa6a0; margin-right: 6px; }
.dc-aChip b { font-family: 'Oswald'; font-size: 13px; color: #6fe0ad; }

.dc-tree { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; padding: 0 12px; max-width: 940px; margin: 0 auto; }
.dc-col { background: rgba(10,18,28,.5); border: 1px solid rgba(120,150,190,.14); border-radius: 10px; padding: 10px 8px; }
.dc-colHead { text-align: center; margin-bottom: 12px; }
.dc-colIcon { font-size: 22px; display: block; }
.dc-colHead b { font-family: 'Oswald'; font-size: 15px; letter-spacing: 1px; color: var(--bacc); display: block; margin-top: 2px; }
.dc-colHead i { font-size: 10px; color: #7e8ea3; font-style: normal; display: block; margin-top: 2px; line-height: 1.2; }
.dc-chain { display: flex; flex-direction: column; align-items: stretch; }
.dc-nodeWrap { display: flex; flex-direction: column; align-items: center; }
.dc-link { width: 3px; height: 14px; background: rgba(120,150,190,.18); }
.dc-link.on { background: var(--bacc); box-shadow: 0 0 6px var(--bacc); }
.dc-node { width: 100%; display: flex; align-items: center; gap: 8px; text-align: left; cursor: pointer; color: #e9eef7;
  background: rgba(18,28,42,.85); border: 1px solid rgba(120,150,190,.2); padding: 9px 9px; transition: transform .12s, border-color .15s, box-shadow .15s;
  clip-path: polygon(0 6px,6px 0,calc(100% - 6px) 0,100% 6px,100% calc(100% - 6px),calc(100% - 6px) 100%,6px 100%,0 calc(100% - 6px)); }
.dc-nIcon { font-size: 20px; flex: 0 0 auto; width: 24px; text-align: center; }
.dc-nBody { flex: 1; min-width: 0; }
.dc-nName { font-family: 'Oswald'; font-size: 13px; letter-spacing: .3px; display: flex; align-items: center; gap: 5px; }
.dc-nDesc { font-size: 10.5px; color: #93a4bd; line-height: 1.2; margin-top: 1px; }
.dc-nCost { flex: 0 0 auto; text-align: right; }
.dc-chk { color: #4fd190; font-size: 12px; }
.dc-owned { font-family: 'Oswald'; font-size: 10px; letter-spacing: 1px; color: #4fd190; }
.dc-can { font-family: 'Oswald'; font-size: 13px; color: #8fdcff; white-space: nowrap; }
.dc-no { font-family: 'Oswald'; font-size: 13px; color: #e5707a; white-space: nowrap; }
.dc-lock { font-size: 13px; opacity: .6; }

.dc-ready { border-color: var(--bacc); box-shadow: 0 0 0 1px var(--bacc), 0 0 14px rgba(255,255,255,.05); }
.dc-ready:hover { transform: translateY(-2px); box-shadow: 0 0 0 1px var(--bacc), 0 6px 18px rgba(0,0,0,.4); }
.dc-owned { /* node */ }
.dc-node.dc-owned { border-color: rgba(79,209,144,.5); background: rgba(28,46,38,.7); cursor: default; }
.dc-node.dc-locked { opacity: .45; cursor: not-allowed; }
.dc-node.dc-need { cursor: not-allowed; }

@media (max-width: 560px) {
  .dc-tree { gap: 6px; padding: 0 8px; }
  .dc-col { padding: 8px 5px; }
  .dc-nIcon { width: 18px; font-size: 17px; }
  .dc-nName { font-size: 11.5px; }
  .dc-nDesc { font-size: 9.5px; }
  .dc-node { gap: 5px; padding: 8px 6px; }
}
`;
