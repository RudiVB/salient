"use client";
import { useState } from "react";
import PolyScene from "@/components/PolyScene";
import {
  getMasterVolume, setMasterVolume, getMusicVolume, setMusicVolume,
  getSfxVolume, setSfxVolume, isMuted, setMuted, playSfx,
} from "@/lib/audio";

/**
 * SettingsScreen — audio settings. components/SettingsScreen.tsx
 * Props: onBack()
 */
export default function SettingsScreen({ onBack }: { onBack?: () => void }) {
  const [master, setMa] = useState(Math.round(getMasterVolume() * 100));
  const [music, setMu] = useState(Math.round(getMusicVolume() * 100));
  const [sfx, setSf] = useState(Math.round(getSfxVolume() * 100));
  const [muted, setMt] = useState(isMuted());

  const onMaster = (v: number) => { setMa(v); setMasterVolume(v / 100); };
  const onMusic = (v: number) => { setMu(v); setMusicVolume(v / 100); };
  const onSfx = (v: number) => { setSf(v); setSfxVolume(v / 100); };

  return (
    <div className="set">
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: CSS }} />
      <PolyScene className="set-bg" />
      <div className="set-shade" />

      <div className="set-panel">
        <div className="set-head">
          <div className="set-kick">OPTIONS</div>
          <h1 className="set-title">SETTINGS</h1>
        </div>

        <div className="set-group">
          <div className="set-gh">AUDIO</div>

          <Row label="Master Volume" value={master} onChange={onMaster} onRelease={() => playSfx("click")} disabled={muted} />
          <Row label="Music" value={music} onChange={onMusic} onRelease={() => playSfx("click")} disabled={muted} />
          <Row label="Sound Effects" value={sfx} onChange={onSfx} onRelease={() => playSfx("hover")} disabled={muted} />

          <div className="set-row set-toggle">
            <span className="set-lab">Mute All</span>
            <button
              className={`set-switch${muted ? " on" : ""}`}
              data-no-sfx
              onClick={() => { const m = !muted; setMt(m); setMuted(m); if (!m) playSfx("click"); }}
              aria-label="mute all"
            ><i /></button>
          </div>

          <button className="set-test" onClick={() => playSfx("hover")}>▸ Test sound effect</button>
        </div>

        <button className="set-back" onClick={onBack}>← Back</button>
      </div>
    </div>
  );
}

function Row({ label, value, onChange, onRelease, disabled }: {
  label: string; value: number; onChange: (v: number) => void; onRelease?: () => void; disabled?: boolean;
}) {
  return (
    <div className={`set-row${disabled ? " dim" : ""}`}>
      <div className="set-rtop"><span className="set-lab">{label}</span><span className="set-val">{value}%</span></div>
      <input
        className="set-slider" type="range" min={0} max={100} value={value} disabled={disabled}
        onChange={(e) => onChange(Number(e.target.value))}
        onMouseUp={onRelease} onTouchEnd={onRelease}
        style={{ ["--fill" as any]: `${value}%` }}
      />
    </div>
  );
}

const CSS = `
.set { position: fixed; inset: 0; z-index: 30; overflow: hidden;
  background: radial-gradient(120% 90% at 50% 10%, #1a2436 0%, #0a0e16 60%, #07090f 100%);
  display: flex; align-items: center; justify-content: center;
  font-family: 'Oswald', system-ui, sans-serif; color: #eef2fa; }
.set-bg { position: absolute; inset: 0; z-index: 0; }
.set-shade { position: absolute; inset: 0; z-index: 1; pointer-events: none;
  background: radial-gradient(120% 100% at 50% 40%, rgba(7,9,15,.45), rgba(7,9,15,.86)); }

.set-panel { position: relative; z-index: 2; width: min(520px, 92vw);
  background: linear-gradient(180deg, rgba(16,24,38,.92), rgba(10,15,24,.95));
  border: 1px solid rgba(120,150,190,.18); padding: 30px 30px 26px;
  clip-path: polygon(0 14px,14px 0,calc(100% - 14px) 0,100% 14px,100% calc(100% - 14px),calc(100% - 14px) 100%,14px 100%,0 calc(100% - 14px));
  -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); }

.set-head { text-align: center; margin-bottom: 22px; }
.set-kick { font-family: 'Space Grotesk', monospace; font-size: 12px; letter-spacing: 6px; color: #f0c860; }
.set-title { margin: 6px 0 0; font-size: 40px; font-weight: 700; letter-spacing: 5px; }

.set-group { display: flex; flex-direction: column; gap: 16px; }
.set-gh { font-family: 'Space Grotesk', monospace; font-size: 11px; letter-spacing: 3px; color: #7d8ba6;
  border-bottom: 1px solid rgba(120,150,190,.15); padding-bottom: 8px; }

.set-row { display: flex; flex-direction: column; gap: 9px; }
.set-row.dim { opacity: .4; }
.set-rtop { display: flex; justify-content: space-between; align-items: baseline; }
.set-lab { font-size: 16px; letter-spacing: 1px; }
.set-val { font-family: 'Space Grotesk', monospace; font-size: 13px; color: #56b9cf; }

.set-slider { -webkit-appearance: none; appearance: none; width: 100%; height: 8px; border-radius: 99px; outline: none;
  background: linear-gradient(90deg, #56b9cf 0%, #56b9cf var(--fill), rgba(150,180,225,.16) var(--fill), rgba(150,180,225,.16) 100%); }
.set-slider::-webkit-slider-thumb { -webkit-appearance: none; appearance: none; width: 20px; height: 20px; border-radius: 50%;
  background: #eef2fa; border: 3px solid #56b9cf; cursor: pointer; box-shadow: 0 2px 8px rgba(0,0,0,.5); }
.set-slider::-moz-range-thumb { width: 18px; height: 18px; border-radius: 50%; background: #eef2fa; border: 3px solid #56b9cf; cursor: pointer; }
.set-slider:disabled { cursor: not-allowed; }

.set-toggle { flex-direction: row; align-items: center; justify-content: space-between; }
.set-switch { position: relative; width: 52px; height: 28px; border-radius: 99px; cursor: pointer;
  background: rgba(150,180,225,.18); border: 1px solid rgba(120,150,190,.25); transition: background .2s; }
.set-switch.on { background: #e5414f; border-color: #e5414f; }
.set-switch i { position: absolute; top: 2px; left: 2px; width: 22px; height: 22px; border-radius: 50%; background: #eef2fa; transition: left .2s; }
.set-switch.on i { left: 26px; }

.set-test { margin-top: 4px; align-self: flex-start; cursor: pointer; font-family: 'Space Grotesk', monospace;
  font-size: 12px; letter-spacing: 2px; color: #93a2bd; background: rgba(30,46,70,.5); border: 1px solid rgba(120,150,190,.2);
  padding: 9px 16px; border-radius: 6px; transition: color .15s, border-color .15s; }
.set-test:hover { color: #eef2fa; border-color: rgba(120,150,190,.5); }

.set-back { margin-top: 24px; width: 100%; cursor: pointer; font-family: 'Oswald', sans-serif;
  font-size: 15px; letter-spacing: 3px; color: #cfe0f2; background: rgba(20,30,46,.6);
  border: 1px solid rgba(120,150,190,.25); padding: 13px; transition: background .15s;
  clip-path: polygon(0 6px,6px 0,calc(100% - 6px) 0,100% 6px,100% calc(100% - 6px),calc(100% - 6px) 100%,6px 100%,0 calc(100% - 6px)); }
.set-back:hover { background: rgba(34,52,78,.85); }
`;
