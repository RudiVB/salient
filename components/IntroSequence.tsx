"use client";
import { useEffect, useRef, useState } from "react";

/**
 * IntroSequence — image-driven cinematic intro with sound (WORLD CONQUEST · 1916).
 * - Each beat shows its own saved background image (crossfade + ken-burns).
 * - Looping ambience + a boom on every scene change.
 * - TAP anywhere → next scene.   "Skip ▸▸" → skip whole intro.   🔊 → mute toggle.
 * Drop-in: <IntroSequence onDone={...} />
 */

type Beat = { kicker?: string; title: string; lines: string[]; bg: string };

const BG = "/intro";            // folder for scene images (public/intro/...)
const SFX = "/audio";           // folder for audio        (public/audio/...)

// ---- STORY (6 beats, each with its own background) ----
const BEATS: Beat[] = [
  { kicker: "THE THIRD WINTER · 1916", title: "IT DID NOT END",          lines: ["It was meant to be over by the first Christmas.", "Instead, the war spread."],                         bg: `${BG}/spread.jpg` },
  {                                    title: "THE NOOSE",               lines: ["One machine, grinding without a front.", "Whoever breaks out first takes everything."],                  bg: `${BG}/noose.jpg` },
  { kicker: "A NEW KIND OF OFFICER",   title: "THEY HANDED YOU AN ARMY", lines: ["The kings have run out of victories to promise.", "Now their armies answer to results. So do you."],     bg: `${BG}/command.jpg` },
  {                                    title: "NUMBERS THAT BLEED",      lines: ["Your regiments are not heroes.", "The good commanders mourn. All of them spend."],                       bg: `${BG}/regiments.jpg` },
  {                                    title: "CHOOSE YOUR POWER",       lines: ["Take command of a great power.", "The rest become the world you intend to take."],                       bg: `${BG}/banners.jpg` },
  {                                    title: "TAKE THE WORLD",          lines: ["Turn the map your colour, province by province.", "Then learn to live in what's left."],                  bg: `${BG}/world.jpg` },
];

const AUTO_MS = 5200;           // auto-advance per scene if untouched
const AMBIENCE_VOL = 0.5;       // target ambience volume (0..1)
const BOOM_VOL = 0.6;           // scene-change hit volume

export default function IntroSequence({ onDone }: { onDone?: () => void }) {
  const [i, setI] = useState(0);
  const [muted, setMuted] = useState(false);
  const iRef = useRef(0);
  const doneRef = useRef(false);
  const mutedRef = useRef(false);

  const ambRef = useRef<HTMLAudioElement | null>(null);   // looping ambience
  const boomRef = useRef<HTMLAudioElement | null>(null);  // scene-change hit
  const fadeRef = useRef<number | null>(null);

  useEffect(() => { iRef.current = i; }, [i]);
  useEffect(() => { mutedRef.current = muted; if (ambRef.current) ambRef.current.muted = muted; }, [muted]);

  // smooth volume fade helper
  const fadeTo = (a: HTMLAudioElement, target: number, ms: number, then?: () => void) => {
    if (fadeRef.current) clearInterval(fadeRef.current);
    const steps = Math.max(1, Math.round(ms / 40));
    const start = a.volume, step = (target - start) / steps;
    let n = 0;
    fadeRef.current = window.setInterval(() => {
      n++; a.volume = Math.min(1, Math.max(0, start + step * n));
      if (n >= steps) { if (fadeRef.current) clearInterval(fadeRef.current); then?.(); }
    }, 40);
  };

  const finish = () => {
    if (doneRef.current) return; doneRef.current = true;
    const a = ambRef.current;
    if (a) fadeTo(a, 0, 400, () => onDone?.());        // fade music out, then leave
    else onDone?.();
  };

  const next = () => {
    if (iRef.current >= BEATS.length - 1) finish();
    else setI(iRef.current + 1);
  };

  // ---- build audio once + start (with autoplay-block fallback) ----
  useEffect(() => {
    const amb = new Audio(`${SFX}/intro-ambience.wav`);
    amb.loop = true; amb.volume = 0; amb.preload = "auto";
    ambRef.current = amb;
    const boom = new Audio(`${SFX}/boom.wav`);
    boom.volume = BOOM_VOL; boom.preload = "auto";
    boomRef.current = boom;

    let started = false;
    const start = () => {
      if (started) return; started = true;
      amb.play().then(() => fadeTo(amb, AMBIENCE_VOL, 1400)).catch(() => { started = false; });
    };
    start();                                            // try immediately
    // if the browser blocked autoplay, start on the first user interaction
    const onGesture = () => { start(); };
    window.addEventListener("pointerdown", onGesture, { once: true });
    window.addEventListener("keydown", onGesture, { once: true });

    return () => {
      window.removeEventListener("pointerdown", onGesture);
      window.removeEventListener("keydown", onGesture);
      if (fadeRef.current) clearInterval(fadeRef.current);
      amb.pause(); boom.pause();
    };
  }, []);

  // ---- per-scene: auto-advance timer + boom on change ----
  useEffect(() => {
    if (i > 0 && boomRef.current && !mutedRef.current) {
      const b = boomRef.current;
      try { b.currentTime = 0; b.play().catch(() => {}); } catch {}
    }
    const t = setTimeout(next, AUTO_MS);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [i]);

  // preload backgrounds so crossfades don't flash
  useEffect(() => { BEATS.forEach((b) => { const img = new window.Image(); img.src = b.bg; }); }, []);

  const beat = BEATS[i];

  return (
    <div className="iv" onClick={next}>
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* stacked backgrounds — only the active one is visible */}
      <div className="iv-bgs">
        {BEATS.map((b, idx) => (
          <div key={idx} className={`iv-bg${idx === i ? " on" : ""}`} style={{ backgroundImage: `url(${b.bg})` }} />
        ))}
      </div>

      {/* readability + film grade */}
      <div className="iv-shade" />
      <div className="iv-vignette" />
      <div className="iv-grain" />

      {/* text (re-mounts per scene so the animation replays) */}
      <div className="iv-stage" key={i}>
        {beat.kicker && <div className="iv-kicker">{beat.kicker}</div>}
        <h2 className="iv-title">{beat.title}</h2>
        <div className="iv-lines">
          {beat.lines.map((l, k) => <p key={k} style={{ animationDelay: `${0.25 + k * 0.45}s` }}>{l}</p>)}
        </div>
      </div>

      {/* UI */}
      <div className="iv-tr">
        <button className="iv-btn" onClick={(e) => { e.stopPropagation(); setMuted((m) => !m); }} aria-label="mute">
          {muted ? "🔇" : "🔊"}
        </button>
        <button className="iv-btn" onClick={(e) => { e.stopPropagation(); finish(); }}>Skip ▸▸</button>
      </div>

      <div className="iv-dots">
        {BEATS.map((_, k) => <i key={k} className={k === i ? "on" : k < i ? "done" : ""} />)}
      </div>
      <div className="iv-hint">tap for next scene</div>
    </div>
  );
}

const CSS = `
.iv { position: fixed; inset: 0; z-index: 30; overflow: hidden; cursor: pointer;
  background: #05070c; color: #eef2fa; font-family: 'Oswald', system-ui, sans-serif;
  display: flex; align-items: center; justify-content: center; }

.iv-bgs { position: fixed; inset: 0; z-index: 0; }
.iv-bg { position: absolute; inset: 0; background-size: cover; background-position: center;
  opacity: 0; transition: opacity 1s ease; will-change: opacity, transform; }
.iv-bg.on { opacity: 1; animation: ivKen 7s ease-out forwards; }
@keyframes ivKen { 0% { transform: scale(1.001); } 100% { transform: scale(1.08) translate(-1.5%, 1%); } }

.iv-shade { position: fixed; inset: 0; z-index: 1; pointer-events: none;
  background: linear-gradient(180deg, rgba(5,7,12,.35) 0%, rgba(5,7,12,.45) 45%, rgba(5,7,12,.72) 100%); }
.iv-vignette { position: fixed; inset: 0; z-index: 1; pointer-events: none;
  background: radial-gradient(120% 100% at 50% 46%, transparent 38%, rgba(0,0,0,.82) 100%); }
.iv-grain { position: fixed; inset: 0; z-index: 1; pointer-events: none; opacity: .22; mix-blend-mode: overlay;
  background-image: radial-gradient(rgba(0,0,0,.3) 1px, transparent 1px); background-size: 3px 3px; }

.iv-stage { position: relative; z-index: 4; text-align: center; padding: 0 24px; max-width: 840px; pointer-events: none; }
.iv-kicker { font-family: 'Space Grotesk', monospace; font-size: 13px; letter-spacing: 6px; color: #f0c860;
  margin-bottom: 16px; opacity: 0; animation: ivUp .8s ease forwards; }
.iv-title { margin: 0 0 18px; font-size: clamp(32px, 7vw, 70px); font-weight: 700; letter-spacing: 4px; line-height: 1.02;
  text-shadow: 0 2px 50px rgba(0,0,0,.9); opacity: 0; animation: ivUp .9s ease .08s forwards; }
.iv-lines p { margin: 6px 0; font-size: clamp(16px, 3vw, 23px); color: #c8d4ea; font-weight: 300;
  text-shadow: 0 2px 24px rgba(0,0,0,.9); opacity: 0; animation: ivUp .8s ease forwards; }
@keyframes ivUp { 0% { opacity: 0; transform: translateY(16px); } 100% { opacity: 1; transform: translateY(0); } }

.iv-tr { position: fixed; top: 22px; right: 22px; z-index: 10; display: flex; gap: 8px; }
.iv-btn { cursor: pointer; font-family: 'Space Grotesk', monospace; font-size: 12px; letter-spacing: 2px; color: #93a2bd;
  background: rgba(20,30,46,.5); border: 1px solid rgba(150,180,225,.22); border-radius: 99px; padding: 8px 14px;
  -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); transition: color .15s, border-color .15s; }
.iv-btn:hover { color: #eef2fa; border-color: rgba(150,180,225,.5); }

.iv-dots { position: fixed; bottom: 30px; left: 0; right: 0; z-index: 10; display: flex; gap: 8px; justify-content: center; pointer-events: none; }
.iv-dots i { width: 7px; height: 7px; border-radius: 99px; background: rgba(150,180,225,.25); transition: all .3s; }
.iv-dots i.done { background: rgba(150,180,225,.5); }
.iv-dots i.on { width: 22px; background: #56b9cf; }
.iv-hint { position: fixed; bottom: 14px; left: 0; right: 0; z-index: 10; text-align: center; pointer-events: none;
  font-family: 'Space Grotesk', monospace; font-size: 10px; letter-spacing: 2px; color: #4f5e7a; }

@media (prefers-reduced-motion: reduce) { .iv-bg.on { animation: none; } }
`;