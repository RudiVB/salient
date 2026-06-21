"use client";
import { useState } from "react";
import { useGame } from "@/lib/store";
import { NATION } from "@/lib/nations";

/**
 * Onboarding — first-session welcome briefing + a "Field Orders" checklist that
 * teaches each system by sending the player to it. components/Onboarding.tsx
 * Rendered inside HubScreen; uses the hub's nav callbacks.
 */
export default function Onboarding({
  onHomeland, onBarracks, onWorld, onDoctrine,
}: { onHomeland?: () => void; onBarracks?: () => void; onWorld?: () => void; onDoctrine?: () => void }) {
  const game = useGame();
  const nat = (game.nation && NATION[game.nation]) || null;
  const accent = nat?.accent || "#56b9cf";
  const [step, setStep] = useState(0);

  const placed = (game.plots || []).filter((p) => p.type).length;
  const orders = [
    { id: "homeland", icon: "🏛", label: "Expand your Homeland — build a 4th structure", done: placed >= 4, on: onHomeland, cta: "Build" },
    { id: "barracks", icon: "🎖", label: "Recruit a regiment in the Barracks", done: game.collection.length >= 2, on: onBarracks, cta: "Recruit" },
    { id: "battle", icon: "⚔", label: "Win your first battle on the World Map", done: (game.wins || 0) >= 1, on: onWorld, cta: "Fight" },
    { id: "territory", icon: "🌍", label: "Capture an enemy region", done: (game.owned?.length || 0) >= 2, on: onWorld, cta: "Invade" },
    { id: "doctrine", icon: "🔬", label: "Research a war doctrine", done: (game.doctrines?.length || 0) >= 1, on: onDoctrine, cta: "Research" },
  ];
  const doneCount = orders.filter((o) => o.done).length;
  const allDone = doneCount === orders.length;

  const steps = [
    { k: "COMMAND HQ", t: "Welcome, Commander", b: `You lead ${nat?.name || "your nation"} into the Great War. Everything runs through this HQ — your economy, your army, and your campaigns.` },
    { k: "THE WAR MACHINE", t: "Your loop to victory", b: "① Grow income & food in the Homeland.  ② Raise and reinforce regiments in the Barracks.  ③ Take ground on the World Map.  ④ Doctrine and Commanders make your army deadlier with every fight." },
    { k: "A LIVING WAR", t: "The world won't wait", b: "Four rival powers fight in real time — even while you're away. Your territory can be lost if you don't defend it, so check in often to hold the line and seize your moment." },
  ];

  return (
    <>
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* welcome briefing (once) */}
      {!game.seenIntro && nat && (
        <div className="ob-overlay">
          <div className="ob-modal" style={{ ["--acc" as any]: accent }}>
            <div className="ob-kick">◢ {steps[step].k} ◣</div>
            <div className="ob-title">{steps[step].t}</div>
            <div className="ob-body">{steps[step].b}</div>
            <div className="ob-dots">{steps.map((_, i) => <i key={i} className={i === step ? "on" : ""} />)}</div>
            <div className="ob-actions">
              <button className="ob-skip" onClick={game.markIntroSeen}>Skip</button>
              {step < steps.length - 1
                ? <button className="ob-next" onClick={() => setStep((s) => s + 1)}>Next ▸</button>
                : <button className="ob-next" onClick={game.markIntroSeen}>Take command ▸</button>}
            </div>
          </div>
        </div>
      )}

      {/* field orders checklist */}
      {!allDone && (
        <div className="ob-orders" style={{ ["--acc" as any]: accent }}>
          <div className="ob-oHead">
            <span>◢ FIELD ORDERS</span>
            <b>{doneCount}/{orders.length}</b>
          </div>
          <div className="ob-oBar"><i style={{ width: `${(doneCount / orders.length) * 100}%` }} /></div>
          <div className="ob-oList">
            {orders.map((o) => (
              <div key={o.id} className={"ob-oRow" + (o.done ? " done" : "")}>
                <span className="ob-oCheck">{o.done ? "✓" : o.icon}</span>
                <span className="ob-oLabel">{o.label}</span>
                {!o.done && o.on && <button className="ob-oGo" onClick={o.on}>{o.cta} ▸</button>}
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

const CSS = `
.ob-overlay { position: fixed; inset: 0; z-index: 60; display: flex; align-items: center; justify-content: center; padding: 20px;
  background: rgba(4,7,13,.78); -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px); animation: obFade .3s ease; }
@keyframes obFade { from { opacity: 0; } to { opacity: 1; } }
.ob-modal { position: relative; width: min(460px, 100%); background: linear-gradient(160deg, #16243a, #0b1320 75%);
  border: 1px solid color-mix(in srgb, var(--acc) 45%, transparent); padding: 24px 22px 18px; text-align: center; color: #e9eef7;
  clip-path: polygon(0 10px,10px 0,calc(100% - 10px) 0,100% 10px,100% calc(100% - 10px),calc(100% - 10px) 100%,10px 100%,0 calc(100% - 10px));
  box-shadow: 0 20px 60px rgba(0,0,0,.6); animation: obPop .3s ease; }
@keyframes obPop { from { transform: scale(.94); opacity: 0; } to { transform: scale(1); opacity: 1; } }
.ob-kick { font-family: 'Space Grotesk', monospace; font-size: 10px; letter-spacing: 3px; color: var(--acc); }
.ob-title { font-family: 'Oswald', sans-serif; font-size: 24px; font-weight: 700; letter-spacing: .5px; margin: 8px 0 12px; }
.ob-body { font-family: 'Space Grotesk', sans-serif; font-size: 13.5px; line-height: 1.6; color: #c4d0e2; font-weight: 300; min-height: 78px; }
.ob-dots { display: flex; gap: 6px; justify-content: center; margin: 16px 0 14px; }
.ob-dots i { width: 7px; height: 7px; border-radius: 50%; background: rgba(160,185,220,.25); transition: background .2s; }
.ob-dots i.on { background: var(--acc); box-shadow: 0 0 8px var(--acc); }
.ob-actions { display: flex; align-items: center; justify-content: space-between; gap: 10px; }
.ob-skip { background: none; border: none; color: #7e8ea3; font-family: 'Space Grotesk', monospace; font-size: 12px; letter-spacing: 1px; cursor: pointer; }
.ob-skip:hover { color: #cfdaec; }
.ob-next { cursor: pointer; font-family: 'Oswald', sans-serif; font-weight: 600; font-size: 15px; letter-spacing: 1px; color: #06222b;
  background: var(--acc); border: none; padding: 11px 20px; clip-path: polygon(0 5px,5px 0,calc(100% - 5px) 0,100% 5px,100% calc(100% - 5px),calc(100% - 5px) 100%,5px 100%,0 calc(100% - 5px)); }
.ob-next:hover { filter: brightness(1.1); }

.ob-orders { position: relative; margin: 18px 0 2px; padding: 13px 15px; background: rgba(11,18,28,.8);
  border: 1px solid rgba(120,150,190,.18); border-left: 3px solid var(--acc); clip-path: var(--cham); }
.ob-oHead { display: flex; align-items: baseline; justify-content: space-between; font-family: 'Space Grotesk', monospace; }
.ob-oHead span { font-size: 11px; letter-spacing: 2px; color: var(--acc); }
.ob-oHead b { font-size: 13px; color: #cfe0ea; }
.ob-oBar { height: 4px; background: rgba(150,180,225,.14); border-radius: 99px; overflow: hidden; margin: 8px 0 10px; }
.ob-oBar i { display: block; height: 100%; background: linear-gradient(90deg, var(--acc), #8fdcff); transition: width .5s; }
.ob-oList { display: flex; flex-direction: column; gap: 6px; }
.ob-oRow { display: flex; align-items: center; gap: 10px; padding: 7px 9px; background: rgba(16,26,40,.6); clip-path: var(--chamS); }
.ob-oRow.done { opacity: .55; }
.ob-oCheck { width: 22px; height: 22px; flex: 0 0 auto; display: grid; place-items: center; font-size: 14px; background: rgba(255,255,255,.05); border-radius: 5px; }
.ob-oRow.done .ob-oCheck { color: #4fd190; background: rgba(79,209,144,.14); }
.ob-oLabel { flex: 1; min-width: 0; font-size: 12.5px; color: #d6e0ef; font-family: 'Space Grotesk', sans-serif; }
.ob-oRow.done .ob-oLabel { text-decoration: line-through; color: #8aa0bd; }
.ob-oGo { flex: 0 0 auto; cursor: pointer; font-family: 'Oswald', sans-serif; font-weight: 600; font-size: 12px; letter-spacing: .5px;
  color: #06222b; background: var(--acc); border: none; padding: 5px 11px; clip-path: var(--chamS); }
.ob-oGo:hover { filter: brightness(1.1); }
`;
