"use client";
import { useGame } from "@/lib/store";
import { NATION } from "@/lib/nations";
import { CATALOG, fmt } from "@/lib/catalog";
import { TMAP, rankForLevel, xpToNext } from "@/lib/heroes";

/**
 * HeroesScreen — roster of named veteran commanders (Pillar 2).
 * components/HeroesScreen.tsx · regiments promoted after surviving battles.
 */
export default function HeroesScreen({ onBack }: { onBack?: () => void }) {
  const game = useGame();
  const accent = (game.nation && NATION[game.nation]?.accent) || "#56b9cf";
  const heroes = (game.collection || []).filter((u) => u.hero).sort((a, b) => (b.hero!.level - a.hero!.level) || (b.hero!.xp - a.hero!.xp));

  const emblem = (seed: number) => {
    const h1 = seed % 360, h2 = (seed * 7) % 360; const sym = seed % 4;
    return (
      <svg viewBox="0 0 40 44" width="40" height="44" aria-hidden>
        <path d="M20 1 L38 7 V22 Q38 36 20 43 Q2 36 2 22 V7 Z" fill={`hsl(${h1} 42% 38%)`} stroke={`hsl(${h1} 45% 60%)`} strokeWidth="1.5" />
        {sym === 0 && <path d="M8 16 H32 L20 30 Z" fill={`hsl(${h2} 60% 62%)`} />}
        {sym === 1 && <path d="M20 8 l3.4 7 7.6.8 -5.7 5.1 1.7 7.5 -7-3.8 -7 3.8 1.7-7.5 -5.7-5.1 7.6-.8 Z" fill={`hsl(${h2} 65% 64%)`} />}
        {sym === 2 && <><rect x="17" y="9" width="6" height="22" rx="1" fill={`hsl(${h2} 60% 62%)`} /><rect x="10" y="16" width="20" height="6" rx="1" fill={`hsl(${h2} 60% 62%)`} /></>}
        {sym === 3 && <><circle cx="20" cy="19" r="8" fill="none" stroke={`hsl(${h2} 65% 64%)`} strokeWidth="3" /><path d="M20 11 v16 M12 19 h16" stroke={`hsl(${h2} 65% 64%)`} strokeWidth="2" /></>}
      </svg>
    );
  };

  return (
    <div className="hr" style={{ ["--acc" as any]: accent }}>
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: CSS }} />

      <div className="hr-top">
        <button className="hr-back" onClick={onBack}>← HQ</button>
        <div className="hr-titles">
          <div className="hr-kick">FIELD COMMANDERS</div>
          <div className="hr-name">{heroes.length} {heroes.length === 1 ? "Commander" : "Commanders"}</div>
        </div>
      </div>

      <div className="hr-sub">Regiments that survive <b>2 winning battles</b> earn a named commander. They level up, gain traits, and buff their regiment — but a wiped-out regiment loses its commander for good.</div>

      {heroes.length === 0 ? (
        <div className="hr-empty">
          <div className="hr-emptyIcon">🎖</div>
          <div className="hr-emptyT">No commanders yet</div>
          <div className="hr-emptyD">Win battles and keep your regiments alive — survivors rise through the ranks and a leader will emerge.</div>
        </div>
      ) : (
        <div className="hr-list">
          {heroes.map((u) => {
            const h = u.hero!; const def = CATALOG[u.defId]; const need = xpToNext(h.level); const pct = Math.min(100, (h.xp / need) * 100);
            return (
              <div key={u.uid} className="hr-card">
                <div className="hr-emblem">{emblem(h.seed)}</div>
                <div className="hr-body">
                  <div className="hr-row1">
                    <div className="hr-cname">{h.name}</div>
                    <div className="hr-lvl">LV {h.level}</div>
                  </div>
                  <div className="hr-rank">{rankForLevel(h.level)} · {def?.name || u.defId} · {fmt(u.troops)} troops {(u.vet || 0) > 0 && <span className="hr-stars">{"★".repeat(Math.min(5, u.vet || 0))}</span>}</div>
                  <div className="hr-xp"><div className="hr-xpFill" style={{ width: `${pct}%` }} /></div>
                  <div className="hr-xpTxt">{h.xp} / {need} XP · {h.battles} {h.battles === 1 ? "battle" : "battles"}</div>
                  <div className="hr-traits">
                    {h.traits.map((tid) => { const t = TMAP[tid]; if (!t) return null; return (
                      <div key={tid} className="hr-trait"><span>{t.icon}</span> <b>{t.name}</b> <i>{t.desc}</i></div>
                    ); })}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const CSS = `
.hr { position: fixed; inset: 0; z-index: 40; overflow-y: auto; color: #e9eef7; font-family: 'Space Grotesk', system-ui, sans-serif;
  background: radial-gradient(120% 90% at 50% 0%, #1a2233 0%, #0b1320 55%, #070b12 100%); padding-bottom: 40px; }
.hr-top { display: flex; align-items: center; gap: 12px; padding: 14px 16px 8px; }
.hr-back { background: rgba(16,24,38,.85); border: 1px solid rgba(120,150,190,.3); color: #cfdaec; cursor: pointer; font-family: 'Oswald'; letter-spacing: 1px; padding: 8px 13px; font-size: 13px; white-space: nowrap;
  clip-path: polygon(0 5px,5px 0,100% 0,100% calc(100% - 5px),calc(100% - 5px) 100%,0 100%); }
.hr-back:hover { border-color: var(--acc); color: #fff; }
.hr-kick { font-size: 10px; letter-spacing: 2.5px; color: var(--acc); font-weight: 700; }
.hr-name { font-family: 'Oswald'; font-size: 21px; font-weight: 600; }
.hr-sub { padding: 0 16px 12px; font-size: 12px; color: #93a4bd; line-height: 1.45; max-width: 720px; } .hr-sub b { color: #cfe0ea; }

.hr-empty { text-align: center; padding: 50px 24px; max-width: 420px; margin: 0 auto; }
.hr-emptyIcon { font-size: 46px; opacity: .8; }
.hr-emptyT { font-family: 'Oswald'; font-size: 19px; margin: 10px 0 6px; }
.hr-emptyD { font-size: 13px; color: #8294ad; line-height: 1.5; }

.hr-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 10px; padding: 0 14px; max-width: 940px; margin: 0 auto; }
.hr-card { display: flex; gap: 12px; background: rgba(12,20,32,.7); border: 1px solid rgba(120,150,190,.18); padding: 12px; align-items: flex-start;
  clip-path: polygon(0 8px,8px 0,calc(100% - 8px) 0,100% 8px,100% calc(100% - 8px),calc(100% - 8px) 100%,8px 100%,0 calc(100% - 8px)); }
.hr-emblem { flex: 0 0 auto; filter: drop-shadow(0 2px 4px rgba(0,0,0,.4)); }
.hr-body { flex: 1; min-width: 0; }
.hr-row1 { display: flex; align-items: baseline; justify-content: space-between; gap: 8px; }
.hr-cname { font-family: 'Oswald'; font-size: 17px; font-weight: 600; letter-spacing: .3px; }
.hr-lvl { font-family: 'Oswald'; font-size: 12px; letter-spacing: 1px; color: var(--acc); background: rgba(86,185,207,.12); border: 1px solid rgba(86,185,207,.3); padding: 1px 7px; border-radius: 4px; white-space: nowrap; }
.hr-rank { font-size: 11.5px; color: #93a4bd; margin: 2px 0 8px; } .hr-stars { color: #f0c860; letter-spacing: 1px; }
.hr-xp { height: 7px; background: rgba(255,255,255,.08); border-radius: 4px; overflow: hidden; }
.hr-xpFill { height: 100%; background: linear-gradient(90deg, var(--acc), #8fdcff); border-radius: 4px; }
.hr-xpTxt { font-family: 'Space Grotesk', monospace; font-size: 9.5px; color: #7e8ea3; margin: 4px 0 9px; }
.hr-traits { display: flex; flex-direction: column; gap: 5px; }
.hr-trait { font-size: 11px; color: #cfdaec; display: flex; align-items: baseline; gap: 6px; background: rgba(20,30,46,.6); padding: 4px 8px; border-radius: 5px; }
.hr-trait b { font-family: 'Oswald'; font-weight: 600; letter-spacing: .3px; } .hr-trait i { font-style: normal; color: #8aa6a0; font-size: 10px; }
`;
