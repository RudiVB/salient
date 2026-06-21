// lib/audio.ts — game-wide sound manager (music + sfx).
//
// Works NOW with just two files (menu sound.mp3 + hover.wav): every sound below is
// aliased to one of those. To upgrade, drop a real file in /public/audio/ and change
// the ONE path in SRC — nothing else needs to change.
//
// Features: autoplay-unlock, overlapping sfx, persisted mute/volume,
// seamless music (won't restart while the same track/file is already playing),
// and a global hover/click listener so EVERY button plays without per-button wiring.

export type SfxName =
  | "hover" | "click" | "nav" | "purchase" | "coin" | "reinforce" | "victory" | "defeat";
export type MusicName =
  | "menuMusic" | "nationMusic" | "hubMusic" | "barracksMusic" | "worldMusic" | "battleMusic";

// ---- sound map (edit these paths as you add real files) ----
const HOVER = "/audio/hover.wav";
const MENU = "/audio/menu sound.mp3";

const SRC: Record<SfxName | MusicName, string> = {
  // sfx — currently aliased to hover.wav (differentiated by rate/volume below)
  hover: HOVER,
  click: HOVER,
  nav: HOVER,
  purchase: HOVER,   // TODO replace with /audio/purchase.wav
  coin: HOVER,       // TODO replace with /audio/coin.wav
  reinforce: HOVER,  // TODO replace with /audio/reinforce.wav
  victory: HOVER,    // TODO replace with /audio/victory.mp3
  defeat: HOVER,     // TODO replace with /audio/defeat.mp3
  // music — menu has a real file; the rest point at their own tracks.
  // Until a file exists the section is SILENT (menu music will NOT bleed in).
  menuMusic: MENU,
  nationMusic: "/audio/nation.mp3",      // drop a file here to add nation music
  hubMusic: "/audio/command.mp3",        // command centre
  barracksMusic: "/audio/barracks.mp3",
  worldMusic: "/audio/world.mp3",
  battleMusic: "/audio/battle.mp3",
};

// per-sound feel tweaks (louder defaults so sfx cut through the music)
const SFX_TUNE: Partial<Record<SfxName, { volume?: number; rate?: number }>> = {
  hover: { volume: 0.9, rate: 1.0 },
  click: { volume: 1.0, rate: 1.0 },
  nav: { volume: 1.0, rate: 0.9 },
  purchase: { volume: 1.0, rate: 1.0 },
  coin: { volume: 0.8, rate: 1.4 },
  reinforce: { volume: 1.0, rate: 0.85 },
  victory: { volume: 1.0, rate: 1.2 },
  defeat: { volume: 1.0, rate: 0.6 },
};

const STORE = "ww1-audio";
let muted = false;
let masterVol = 0.8;   // overall
let musicVol = 0.4;    // music bus (relative to master)
let sfxVol = 1.0;      // sfx bus (relative to master)

if (typeof window !== "undefined") {
  try {
    const p = JSON.parse(localStorage.getItem(STORE) || "{}");
    if (typeof p.muted === "boolean") muted = p.muted;
    if (typeof p.master === "number") masterVol = p.master;
    if (typeof p.music === "number") musicVol = p.music;
    if (typeof p.sfx === "number") sfxVol = p.sfx;
  } catch { /* ignore */ }
}
function persist() {
  if (typeof window === "undefined") return;
  try { localStorage.setItem(STORE, JSON.stringify({ muted, master: masterVol, music: musicVol, sfx: sfxVol })); } catch { /* ignore */ }
}
const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// ---- one-shot sfx ----
const sfxBase: Partial<Record<string, HTMLAudioElement>> = {};
function base(src: string): HTMLAudioElement {
  let a = sfxBase[src];
  if (!a) { a = new Audio(src); a.preload = "auto"; sfxBase[src] = a; }
  return a;
}

export function playSfx(name: SfxName, opts: { volume?: number; rate?: number } = {}) {
  if (typeof window === "undefined" || muted) return;
  const tune = SFX_TUNE[name] || {};
  try {
    const a = base(SRC[name]).cloneNode(true) as HTMLAudioElement;  // clone → overlaps
    a.volume = Math.min(1, masterVol * sfxVol * (opts.volume ?? tune.volume ?? 1));  // master × sfx bus × per-sound
    a.playbackRate = opts.rate ?? tune.rate ?? 1;
    a.play().catch(() => { /* needs a gesture */ });
  } catch { /* ignore */ }
}

// ---- music (ONE shared element; survives HMR; never overlaps or restarts on same file) ----
let pending: MusicName | null = null;
let unlockArmed = false;

function musicEl(): HTMLAudioElement {
  const w = window as unknown as { __ww1Music?: HTMLAudioElement; __ww1Missing?: Set<string> };
  if (!w.__ww1Missing) w.__ww1Missing = new Set();
  if (!w.__ww1Music) {
    const a = new Audio(); a.loop = true;
    a.addEventListener("error", () => { if (a.dataset.src) w.__ww1Missing!.add(a.dataset.src); });
    w.__ww1Music = a;
  }
  return w.__ww1Music;
}
function missingMusic(): Set<string> {
  const w = window as unknown as { __ww1Missing?: Set<string> };
  return w.__ww1Missing || new Set();
}

export function playMusic(name: MusicName, vol = musicVol) {
  if (typeof window === "undefined") return;
  musicVol = vol;
  const m = musicEl();
  const src = SRC[name];
  // file is known-missing → stay silent and make sure nothing else keeps playing
  if (missingMusic().has(src)) { stopMusic(); return; }
  const target = Math.min(1, masterVol * vol);
  // same FILE already loaded → just make sure it's playing, never restart
  if (m.dataset.src === src) {
    m.volume = muted ? 0 : target;
    if (m.paused) m.play().catch(() => { pending = name; armUnlock(); });
    return;
  }
  // different file → swap src on the SAME element (no second element = no overlap)
  m.src = src; m.dataset.src = src; m.loop = true; m.volume = muted ? 0 : target;
  m.play().catch(() => { pending = name; armUnlock(); });
}

export function stopMusic() {
  if (typeof window === "undefined") return;
  const w = window as unknown as { __ww1Music?: HTMLAudioElement };
  if (w.__ww1Music) { w.__ww1Music.pause(); w.__ww1Music.currentTime = 0; w.__ww1Music.dataset.src = ""; }
  pending = null;
}

function armUnlock() {
  if (unlockArmed || typeof window === "undefined") return;
  unlockArmed = true;
  const go = () => {
    unlockArmed = false;
    window.removeEventListener("pointerdown", go);
    window.removeEventListener("keydown", go);
    if (pending) { const n = pending; pending = null; playMusic(n, musicVol); }
  };
  window.addEventListener("pointerdown", go, { once: true });
  window.addEventListener("keydown", go, { once: true });
}

// ---- mute / volume ----
function applyMusicVol() {
  if (typeof window === "undefined") return;
  const w = window as unknown as { __ww1Music?: HTMLAudioElement };
  if (w.__ww1Music) w.__ww1Music.volume = muted ? 0 : Math.min(1, masterVol * musicVol);
}
export function isMuted() { return muted; }
export function setMuted(m: boolean) { muted = m; applyMusicVol(); persist(); }
export function toggleMute() { setMuted(!muted); return muted; }
export function getMasterVolume() { return masterVol; }
export function setMasterVolume(v: number) { masterVol = clamp01(v); applyMusicVol(); persist(); }
export function getMusicVolume() { return musicVol; }
export function setMusicVolume(v: number) { musicVol = clamp01(v); applyMusicVol(); persist(); }
export function getSfxVolume() { return sfxVol; }
export function setSfxVolume(v: number) { sfxVol = clamp01(v); persist(); }

// ---- GLOBAL hover/click for buttons & links (call once from the app root) ----
let globalArmed = false;
const SEL = 'button, a[href], [role="button"], [data-sfx]';
let lastHover: Element | null = null;
let lastHoverAt = 0;
const HOVER_COOLDOWN = 140;   // ms — minimum gap between hover sounds

// resolve to the nearest real control (button/link/role/[data-sfx]); ignore everything else
function interactive(start: Element | null): Element | null {
  let node: Element | null = start;
  for (let i = 0; i < 5 && node; i++) {
    if (node.hasAttribute?.("data-no-sfx")) return null;
    if (node.matches?.(SEL)) return node;
    node = node.parentElement;
  }
  return null;
}

export function initGlobalSfx() {
  if (globalArmed || typeof window === "undefined") return;
  globalArmed = true;

  document.addEventListener("pointerover", (e) => {
    const t = interactive(e.target as Element);
    if (!t) { lastHover = null; return; }                  // background → arm for next entry
    if (t === lastHover || (t as HTMLButtonElement).disabled) return;
    lastHover = t;
    const now = performance.now();
    if (now - lastHoverAt < HOVER_COOLDOWN) return;        // rate-limit
    lastHoverAt = now;
    playSfx("hover");                                      // once per fresh control, never on leave
  }, { passive: true });

  document.addEventListener("click", (e) => {
    const t = interactive(e.target as Element);
    if (!t || (t as HTMLButtonElement).disabled) return;
    playSfx("click");
  }, { passive: true });
}
