"use client";
import { useEffect, useRef, useState } from "react";
import PolyScene from "@/components/PolyScene";
import { toggleMute, isMuted } from "@/lib/audio";

/**
 * MainMenu — the title screen. components/MainMenu.tsx
 * Props: onContinue, onNew, hasSave (hides Continue when false).
 *
 * Wiring (app/page.tsx):
 *   const [screen, setScreen] = useState<"menu"|"game">("menu");
 *   if (screen === "menu") return (
 *     <MainMenu hasSave={!!game.position}
 *       onContinue={() => setScreen("game")}
 *       onNew={() => { game.reset(); setScreen("game"); }} />
 *   );
 */
export default function MainMenu({
  onContinue, onNew, onSettings, onMultiplayer, onAccount, hasSave = true,
}: { onContinue?: () => void; onNew?: () => void; onSettings?: () => void; onMultiplayer?: () => void; onAccount?: () => void; hasSave?: boolean }) {
  const sceneRef = useRef<HTMLDivElement>(null);
  const [howto, setHowto] = useState(false);
  const [muted, setMuted] = useState(false);

  // music is driven by app/page.tsx per-screen; just sync the mute icon here
  useEffect(() => { setMuted(isMuted()); }, []);

  useEffect(() => {
    const el = sceneRef.current; if (!el) return;
    const move = (e: PointerEvent) => {
      el.style.setProperty("--px", String(e.clientX / window.innerWidth - 0.5));
      el.style.setProperty("--py", String(e.clientY / window.innerHeight - 0.5));
    };
    window.addEventListener("pointermove", move);
    return () => window.removeEventListener("pointermove", move);
  }, []);

  return (
    <div className="mm" ref={sceneRef}>
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="mm-sky" />
      <div className="mm-glow" />
      <div className="mm-fog mm-fog1" />
      <div className="mm-fog mm-fog2" />

      {/* low-poly 3D battlefield */}
      <PolyScene className="mm-scene3d" />

      {/* embers */}
      <div className="mm-embers">{Array.from({ length: 9 }).map((_, i) => <i key={i} style={{ left: `${8 + i * 10}%`, animationDelay: `${i * 1.3}s`, animationDuration: `${7 + (i % 4) * 2}s` }} />)}</div>

      <div className="mm-vignette" />
      <div className="mm-grain" />

      <div className="mm-content">
        <div className="mm-kicker">A WORLD AT WAR</div>
        <h1 className="mm-title"><span>SALIENT</span></h1>
        <div className="mm-year">· 1916 ·</div>
        <div className="mm-tag">Raise regiments. Hold your fronts. Conquer the world.</div>
        <div className="mm-menu">
          {hasSave && <button className="mm-btn mm-primary" onClick={onContinue}>▸ Continue Campaign</button>}
          <button className="mm-btn" onClick={onNew}>New Campaign</button>
          <button className="mm-btn" onClick={onMultiplayer}>⚔ Multiplayer</button>
          <button className="mm-btn mm-ghost" onClick={onAccount}>Account · Cloud Save</button>
          <button className="mm-btn mm-ghost" onClick={() => setHowto(true)}>How to Play</button>
          <button className="mm-btn mm-ghost" onClick={onSettings}>Settings</button>
        </div>
      </div>

      <button
        className="mm-mute"
        data-no-sfx
        onClick={() => setMuted(toggleMute())}
        aria-label={muted ? "Unmute" : "Mute"}
      >{muted ? "🔇" : "🔊"}</button>
      <button className="mm-mute mm-gear" onClick={onSettings} aria-label="Settings">⚙</button>

      <div className="mm-footer">v0.2 · build in progress</div>

      {howto && (
        <div className="mm-modal" onClick={() => setHowto(false)}>
          <div className="mm-panel" onClick={(e) => e.stopPropagation()}>
            <div className="mm-ph">HOW TO PLAY</div>
            <ul className="mm-list">
              <li><b>Regiments, not single soldiers.</b> Each unit is thousands of men who take casualties in battle.</li>
              <li><b>Climb the campaign map.</b> Choose a route through five regions of the front.</li>
              <li><b>Fight battles.</b> Deploy your line; losses carry back to your collection.</li>
              <li><b>Keep your numbers up.</b> Spend Supplies to reinforce — medics slow the bleeding. A regiment at zero is lost.</li>
              <li><b>Build combined arms.</b> Mix infantry, armour and artillery for doctrine bonuses.</li>
            </ul>
            <button className="mm-btn mm-primary" style={{ width: "100%", marginTop: 6 }} onClick={() => setHowto(false)}>Understood</button>
          </div>
        </div>
      )}
    </div>
  );
}

const CSS = `
.mm { position: relative; min-height: 100vh; width: 100%; overflow: hidden;
  font-family: 'Oswald', system-ui, sans-serif; color: #e9eef7; --px: 0; --py: 0; isolation: isolate;
  --cham: polygon(0 8px, 8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px));
  --cham12: polygon(0 12px, 12px 0, calc(100% - 12px) 0, 100% 12px, 100% calc(100% - 12px), calc(100% - 12px) 100%, 12px 100%, 0 calc(100% - 12px)); }
.mm-sky { position: absolute; inset: 0; z-index: 0;
  background: linear-gradient(180deg, #0a0f1a 0%, #111c2e 42%, #1c3146 72%, #2b4a5e 100%); }
.mm-glow { position: absolute; left: 50%; bottom: 6%; width: 120%; height: 62%; transform: translateX(-50%); z-index: 0;
  background: radial-gradient(58% 70% at 50% 100%, rgba(120,180,205,.4), rgba(120,180,205,0) 70%); filter: blur(6px); }
.mm-fog { position: absolute; bottom: 12%; width: 60%; height: 220px; border-radius: 50%; z-index: 1;
  background: radial-gradient(closest-side, rgba(180,200,220,.15), transparent 70%); filter: blur(26px); }
.mm-fog1 { left: -10%; animation: mmFog1 26s ease-in-out infinite; }
.mm-fog2 { right: -12%; bottom: 22%; animation: mmFog2 32s ease-in-out infinite; }
@keyframes mmFog1 { 0%,100% { transform: translateX(0); } 50% { transform: translateX(28%); } }
@keyframes mmFog2 { 0%,100% { transform: translateX(0); } 50% { transform: translateX(-26%); } }

.mm-scene3d { position: absolute; inset: 0; z-index: 1; }
.mm-far { fill: #16243a; }
.mm-mid { fill: #0e1826; stroke: #0e1826; stroke-width: 6; stroke-linecap: round; stroke-linejoin: round; }
.mm-mid path { fill: #0e1826; }
.mm-thin { fill: none; stroke: #0e1826; stroke-width: 2; opacity: .75; }
.mm-near { fill: #05080e; }
.mm-crater { fill: #090f18; }
.mm-tank-body { fill: #0a1220; }
.mm-tank-line { fill: none; stroke: #243549; stroke-width: 2.2; stroke-linecap: round; stroke-linejoin: round; }
.mm-barrel { stroke-width: 4; }
.mm-hole { fill: #21384e; }
.mm-fire { fill: #e0863c; filter: blur(4px); opacity: .5; animation: mmFire 2.6s ease-in-out infinite; }
@keyframes mmFire { 0%,100% { opacity: .35; } 50% { opacity: .7; } }
.mm-sun { fill: #b9cdd8; opacity: .13; filter: blur(2px); }
.mm-smoke { fill: #aab4c4; }
.mm-smokefar { opacity: .09; filter: blur(8px); }
.mm-smoketank { opacity: .2; filter: blur(7px); transform-box: fill-box; transform-origin: bottom; animation: mmSmokeT 9s ease-in-out infinite; }
@keyframes mmSmokeT { 0%,100% { transform: translateX(0) scaleY(1); } 50% { transform: translateX(12px) scaleY(1.05); } }
.mm-wire { fill: none; stroke: #05080e; stroke-width: 2; stroke-linecap: round; }

.mm-embers { position: absolute; inset: 0; z-index: 2; pointer-events: none; }
.mm-embers i { position: absolute; bottom: 14%; width: 3px; height: 3px; border-radius: 99px;
  background: #f0c860; box-shadow: 0 0 6px #f0c860; opacity: 0; animation: mmEmber linear infinite; }
@keyframes mmEmber { 0% { transform: translateY(0); opacity: 0; } 15% { opacity: .8; } 100% { transform: translateY(-340px) translateX(20px); opacity: 0; } }

.mm-vignette { position: absolute; inset: 0; z-index: 3; pointer-events: none;
  background: radial-gradient(130% 100% at 50% 30%, transparent 45%, rgba(0,0,0,.72) 100%); }
.mm-grain { position: absolute; inset: 0; z-index: 3; pointer-events: none; opacity: .32; mix-blend-mode: overlay;
  background-image: radial-gradient(rgba(0,0,0,.3) 1px, transparent 1px); background-size: 3px 3px; }

.mm-content { position: relative; z-index: 4; display: flex; flex-direction: column; align-items: center; text-align: center;
  padding: 14vh 20px 0; transform: translate(calc(var(--px) * 8px), calc(var(--py) * 6px)); }
.mm-kicker { font-size: 12px; letter-spacing: 6px; color: #7f93b4; margin-bottom: 10px; }
.mm-title { margin: 0; font-size: clamp(46px, 11vw, 104px); font-weight: 700; letter-spacing: 6px; line-height: .92; text-shadow: 0 2px 30px rgba(0,0,0,.6); }
.mm-title span { color: #56b9cf; text-shadow: 0 0 36px rgba(86,185,207,.55); }
.mm-year { font-family: 'Space Grotesk', monospace; letter-spacing: 8px; color: #f0c860; margin-top: 10px; font-size: clamp(13px, 2.4vw, 17px); }
.mm-tag { color: #9fb0cc; margin-top: 14px; font-size: clamp(13px, 2.6vw, 16px); max-width: 460px; }

.mm-menu { display: flex; flex-direction: column; gap: 12px; margin-top: 38px; width: min(320px, 84vw); }
.mm-btn { position: relative; font-family: 'Oswald', sans-serif; font-weight: 600; font-size: 16px; letter-spacing: 1.5px;
  cursor: pointer; padding: 14px 18px; color: #e9eef7; background: rgba(140,175,215,.32); border: none; clip-path: var(--cham);
  transition: transform .12s, filter .15s; }
.mm-btn::before { content: ""; position: absolute; inset: 1.5px; background: #101a28; clip-path: var(--cham); z-index: -1; }
.mm-btn:hover { transform: translateY(-2px); filter: brightness(1.14); }
.mm-btn:active { transform: translateY(0); }
.mm-primary { color: #06222b; font-weight: 700; background: #9be0ee; filter: drop-shadow(0 8px 18px rgba(86,185,207,.45)); }
.mm-primary::before { background: linear-gradient(180deg, #74cee0, #3f9fb8); }
.mm-ghost { background: rgba(150,180,225,.18); color: #9fb0cc; }
.mm-ghost::before { background: rgba(10,16,26,.4); }

.mm-footer { position: absolute; bottom: 14px; left: 0; right: 0; text-align: center; z-index: 4;
  font-family: 'Space Grotesk', monospace; font-size: 11px; letter-spacing: 2px; color: #4f5e7a; }
.mm-mute { position: absolute; top: 16px; right: 18px; z-index: 6; cursor: pointer;
  width: 40px; height: 40px; font-size: 16px; line-height: 1; color: #cfe0f2;
  background: rgba(14,24,38,.6); border: 1px solid rgba(120,150,190,.2); border-radius: 8px;
  transition: background .15s, transform .15s; }
.mm-mute:hover { background: rgba(30,46,70,.8); transform: scale(1.06); }
.mm-gear { right: 66px; }

.mm-modal { position: fixed; inset: 0; z-index: 20; display: flex; align-items: center; justify-content: center;
  background: rgba(4,8,14,.7); backdrop-filter: blur(4px); padding: 20px; animation: mmIn .2s ease; }
.mm-panel { position: relative; width: min(460px, 100%); background: rgba(140,175,215,.3); clip-path: var(--cham12);
  padding: 22px; filter: drop-shadow(0 24px 50px rgba(0,0,0,.7)); }
.mm-panel::before { content: ""; position: absolute; inset: 2px; background: #111c2a; clip-path: var(--cham12); z-index: -1; }
.mm-ph { font-size: 14px; letter-spacing: 3px; color: #56b9cf; font-weight: 700; margin-bottom: 14px; }
.mm-list { margin: 0 0 16px; padding-left: 18px; color: #c2cee2; line-height: 1.55; font-size: 14px; }
.mm-list li { margin-bottom: 9px; }
.mm-list b { color: #e9eef7; font-weight: 600; }
@keyframes mmIn { 0% { opacity: 0; } 100% { opacity: 1; } }

@media (max-width: 640px) {
  .mm-content { padding-top: 12vh; }
  .mm-title { letter-spacing: 3px; }
  .mm-scene { height: 50%; }
}
@media (prefers-reduced-motion: reduce) { .mm-fog, .mm-embers i, .mm-smoketank, .mm-fire { animation: none; } }
`;