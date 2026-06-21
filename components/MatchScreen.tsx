"use client";
/**
 * MatchScreen — live multiplayer match. components/MatchScreen.tsx
 * The host advances the shared world (sessions.world) every TURN_MS and writes it;
 * everyone renders from Realtime. Players steer their faction via a war stance.
 * Reuses the real 3D WorldGlobe, recoloured by faction via its colorMap prop.
 *
 * Wiring (app/page.tsx):
 *   <MatchScreen sessionId={m.sessionId} seat={m.seat} code={m.code} onExit={() => setScreen("menu")} />
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import WorldGlobe from "@/components/WorldGlobe";
import { TERRITORIES, type Owner } from "@/lib/world";
import { getUid, SEATS, type Seat } from "@/lib/lobby";
import { authUserId } from "@/lib/auth";
import { recordResult } from "@/lib/profiles";
import {
  SEAT_FACTION, FACTION_COLOR, standings, colorMapOf, mpOutcome, mpTick,
  type MPWorld, type Stance, type FactionId,
} from "@/lib/mpworld";
import {
  loadMatch, writeWorld, setStance as apiSetStance, endMatch, fetchSeatStances, subscribeMatch,
  claimHost, ensureSeeded, type MatchSession,
} from "@/lib/match";
import type { RealtimeChannel } from "@supabase/supabase-js";

const TURN_MS = 8000;                            // one world turn every 8s
const STALE_MS = TURN_MS * 2;                     // host considered gone after this with no turn
const STANCES: Stance[] = ["aggressive", "balanced", "defensive"];
const STANCE_LABEL: Record<Stance, string> = { aggressive: "⚔ Aggressive", balanced: "⚖ Balanced", defensive: "🛡 Defensive" };

// dummy ownership for WorldGlobe (colorMap overrides the actual colours)
const ALL_ENEMY: Record<string, Owner> = Object.fromEntries(TERRITORIES.map((t) => [t.id, "enemy"]));

export default function MatchScreen({ sessionId, seat, code, onExit }: {
  sessionId: string; seat: Seat; code: string; onExit: () => void;
}) {
  const [world, setWorld] = useState<MPWorld | null>(null);
  const [status, setStatus] = useState<string>("active");
  const [hostId, setHostId] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());
  const [pending, setPending] = useState(false);

  const myFaction = SEAT_FACTION[seat] as FactionId;
  const uid = typeof window !== "undefined" ? getUid() : "ssr";
  const isHost = hostId === uid;

  const worldRef = useRef<MPWorld | null>(null);     // latest world for the host loop
  const tickingRef = useRef(false);                  // re-entrancy guard
  const channelRef = useRef<RealtimeChannel | null>(null);
  const lastTickRef = useRef<number>(-1);            // last world.tick we anchored the countdown to
  const [turnAnchor, setTurnAnchor] = useState<number>(Date.now());   // local time the current turn started
  useEffect(() => { worldRef.current = world; }, [world]);

  // reset the countdown anchor whenever a NEW turn lands (host or via realtime).
  // This makes the timer smooth and identical on every client, ignoring clock skew.
  useEffect(() => {
    if (!world) return;
    if (world.tick !== lastTickRef.current) { lastTickRef.current = world.tick; setTurnAnchor(Date.now()); }
  }, [world]);

  /* ---------------- initial load + realtime ---------------- */
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const s = await loadMatch(sessionId);
        if (!alive || !s) return;
        setHostId(s.host_id); setStatus(s.status);
        let w = (s.world as MPWorld) || null;
        // host arriving to an un-seeded active match → seed it now
        if (!w && s.status === "active" && s.host_id === uid) w = await ensureSeeded(sessionId);
        setWorld(w);
      } catch (e) { setError(msg(e)); }
      finally { if (alive) setLoading(false); }
    })();

    channelRef.current = subscribeMatch(sessionId, (s: MatchSession) => {
      setStatus(s.status); setHostId(s.host_id);
      if (s.world) setWorld(s.world as MPWorld);
      if (s.status === "ended") setTimeout(onExit, 1500);
    });
    return () => { alive = false; channelRef.current?.unsubscribe(); channelRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId]);

  /* ---------------- countdown ticker (display only) ---------------- */
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(t); }, []);

  /* ---------------- turn driver (host advances; any player takes over if host is gone) ---------------- */
  const runTurn = useCallback(async () => {
    if (tickingRef.current) return;
    const w = worldRef.current;
    if (!w || w.paused) return;
    tickingRef.current = true;
    try {
      const stanceByFaction = await fetchSeatStances(sessionId);   // latest player stances
      const { world: next } = mpTick(w, stanceByFaction);
      setWorld(next);                                              // snappy local update
      await writeWorld(sessionId, next);                           // broadcast to everyone
    } catch (e) { setError(msg(e)); }
    finally { tickingRef.current = false; }
  }, [sessionId]);

  // Single 1s checker. The host advances when its 8s have elapsed. If the world
  // goes stale (host left), the present players take over in seat order so the
  // match keeps running for whoever rejoined.
  const takeoverDelay = STALE_MS + Math.max(0, SEATS.indexOf(seat)) * 2000;   // staggered by seat
  const claimingRef = useRef(false);
  useEffect(() => {
    if (status !== "active") return;
    const t = setInterval(async () => {
      const w = worldRef.current;
      if (!w || w.paused) return;
      const elapsed = Date.now() - w.lastTurnAt;
      if (elapsed < TURN_MS) return;                               // not time for a turn yet
      if (isHost) { runTurn(); return; }
      if (elapsed > takeoverDelay && !claimingRef.current) {       // host seems gone → take over
        claimingRef.current = true;
        try { await claimHost(sessionId); setHostId(uid); await runTurn(); }
        catch (e) { setError(msg(e)); }
        finally { claimingRef.current = false; }
      }
    }, 1000);
    return () => clearInterval(t);
  }, [status, isHost, runTurn, sessionId, takeoverDelay, uid]);

  /* ---------------- record result once the match is decided ---------------- */
  const recordedRef = useRef(false);
  useEffect(() => {
    if (recordedRef.current || !world) return;
    const decided = !!mpOutcome(world) || status === "ended";
    if (!decided || !authUserId()) return;                       // guests aren't ranked
    const winner = mpOutcome(world) || standings(world)[0]?.factionId;
    if (!winner) return;
    recordedRef.current = true;
    recordResult(sessionId, myFaction, winner === myFaction).catch(() => {});
  }, [status, world, myFaction, sessionId]);

  /* ---------------- actions ---------------- */
  async function chooseStance(s: Stance) {
    if (!world) return;
    // optimistic local update so the UI reacts instantly
    setWorld({ ...world, stance: { ...world.stance, [myFaction]: s } });
    try { await apiSetStance(sessionId, s); } catch (e) { setError(msg(e)); }
  }
  async function togglePause() {
    if (!world || !isHost) return;
    setPending(true);
    try { const next = { ...world, paused: !world.paused }; setWorld(next); await writeWorld(sessionId, next); }
    catch (e) { setError(msg(e)); } finally { setPending(false); }
  }
  async function doEnd() {
    if (!isHost) { onExit(); return; }
    setPending(true);
    try { await endMatch(sessionId); } catch (e) { setError(msg(e)); onExit(); } finally { setPending(false); }
  }

  /* ---------------- derived ---------------- */
  const board = useMemo(() => (world ? standings(world) : []), [world]);
  const colorMap = useMemo(() => (world ? colorMapOf(world) : {}), [world]);
  const myStance: Stance = world?.stance[myFaction] || "balanced";
  const outcome = world ? mpOutcome(world) : null;
  const paused = !!world?.paused;
  const secsLeft = world ? Math.max(0, Math.ceil((TURN_MS - (now - turnAnchor)) / 1000)) : 0;
  const myCount = board.find((b) => b.factionId === myFaction)?.count ?? 0;

  /* ---------------- render ---------------- */
  return (
    <div className="ms-wrap">
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* top bar */}
      <div className="ms-top">
        <div className="ms-tl">
          <span className="ms-dot" style={{ background: FACTION_COLOR[myFaction] }} />
          <span className="ms-code">{code}</span>
          <span className="ms-muted">· Turn {world?.tick ?? 0}</span>
        </div>
        <div className="ms-tr">
          {status === "active" && !paused && <span className="ms-clock">next turn {secsLeft}s</span>}
          {paused && <span className="ms-paused">PAUSED</span>}
          {isHost && status === "active" && (
            <button className="ms-btn ms-ghost" disabled={pending} onClick={togglePause}>{paused ? "Resume" : "Pause"}</button>
          )}
          <button className="ms-btn ms-danger" disabled={pending} onClick={doEnd}>{isHost ? "End Match" : "Leave"}</button>
        </div>
      </div>

      <div className="ms-body">
        {/* globe */}
        <div className="ms-globe">
          {loading || !world ? (
            <div className="ms-globeload"><div className="ms-spin" /><div className="ms-muted">Loading the front…</div></div>
          ) : (
            <WorldGlobe
              accent={FACTION_COLOR[myFaction]}
              ownership={ALL_ENEMY}
              colorMap={colorMap}
              selectedId={null}
              attackable={EMPTY}
              onSelect={() => {}}
            />
          )}
        </div>

        {/* sidebar */}
        <div className="ms-side">
          {/* standings */}
          <div className="ms-card">
            <div className="ms-h">STANDINGS</div>
            {loading || !world ? (
              <div className="ms-skel-col">{[0,1,2,3].map((i)=><div key={i} className="ms-skel" />)}</div>
            ) : (
              <div className="ms-stand">
                {board.map((b) => (
                  <div key={b.factionId} className={"ms-srow" + (b.factionId === myFaction ? " me" : "") + (b.count === 0 ? " dead" : "")}>
                    <span className="ms-sc" style={{ background: b.color }} />
                    <span className="ms-sname">{b.name}{b.isAi && <span className="ms-ai">AI</span>}{b.factionId === myFaction && <span className="ms-you">YOU</span>}</span>
                    <span className="ms-spct">{b.count === 0 ? "out" : `${b.count} · ${b.pct}%`}</span>
                    <span className="ms-bar"><span style={{ width: `${b.pct}%`, background: b.color }} /></span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* my stance */}
          <div className="ms-card">
            <div className="ms-h">YOUR WAR STANCE</div>
            <div className="ms-muted" style={{ marginBottom: 8 }}>You hold {myCount} territor{myCount === 1 ? "y" : "ies"}. Stance steers your army next turn.</div>
            <div className="ms-stances">
              {STANCES.map((s) => (
                <button key={s} className={"ms-stbtn" + (myStance === s ? " on" : "")} onClick={() => chooseStance(s)} disabled={!world}>
                  {STANCE_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          {/* event feed */}
          <div className="ms-card ms-feedcard">
            <div className="ms-h">DISPATCHES</div>
            {loading || !world ? (
              <div className="ms-skel-col">{[0,1,2].map((i)=><div key={i} className="ms-skel" />)}</div>
            ) : (
              <div className="ms-feed">
                {world.log.map((line, i) => <div key={i} className="ms-line" style={{ opacity: 1 - i * 0.05 }}>{line}</div>)}
              </div>
            )}
          </div>
        </div>
      </div>

      {error && <div className="ms-err">{error}</div>}

      {/* outcome overlay */}
      {outcome && (
        <div className="ms-overlay">
          <div className="ms-result">
            <div className="ms-rk" style={{ color: FACTION_COLOR[outcome] }}>{outcome === myFaction ? "VICTORY" : "WAR'S END"}</div>
            <div className="ms-rsub">{world ? standings(world).find((b)=>b.factionId===outcome)?.name : ""} dominates the world.</div>
            <button className="ms-btn ms-primary" onClick={doEnd}>{isHost ? "End Match" : "Leave"}</button>
          </div>
        </div>
      )}
    </div>
  );
}

const EMPTY = new Set<string>();
function msg(e: unknown): string { return e instanceof Error ? e.message : "Something went wrong."; }

const CSS = `
.ms-wrap { position: relative; min-height: 100vh; background: #070b12; color: #e9eef7;
  font-family: 'Oswald', system-ui, sans-serif; display: flex; flex-direction: column;
  --cham: polygon(0 7px,7px 0,calc(100% - 7px) 0,100% 7px,100% calc(100% - 7px),calc(100% - 7px) 100%,7px 100%,0 calc(100% - 7px)); }
.ms-top { display: flex; align-items: center; justify-content: space-between; padding: 12px 18px;
  border-bottom: 1px solid rgba(120,150,190,.16); background: rgba(10,16,26,.7); z-index: 5; }
.ms-tl, .ms-tr { display: flex; align-items: center; gap: 10px; }
.ms-dot { width: 12px; height: 12px; border-radius: 50%; }
.ms-code { font-family: 'Space Grotesk', monospace; letter-spacing: 4px; font-size: 18px; color: #f0c860; }
.ms-muted { color: #8092b0; font-size: 13px; }
.ms-clock { font-family: 'Space Grotesk', monospace; font-size: 13px; color: #56b9cf; }
.ms-paused { font-weight: 700; letter-spacing: 2px; color: #f0c860; font-size: 13px; }

.ms-body { flex: 1; display: grid; grid-template-columns: 1fr 340px; min-height: 0; }
@media (max-width: 820px) { .ms-body { grid-template-columns: 1fr; } }
.ms-globe { position: relative; min-height: 360px; }
.ms-globe > div { position: absolute; inset: 0; }
.ms-globeload { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 12px; }

.ms-side { border-left: 1px solid rgba(120,150,190,.16); padding: 14px; display: flex; flex-direction: column; gap: 12px; overflow: auto; background: rgba(8,12,20,.6); }
@media (max-width: 820px) { .ms-side { border-left: none; border-top: 1px solid rgba(120,150,190,.16); } }
.ms-card { position: relative; background: rgba(140,175,215,.07); border: 1px solid rgba(120,150,190,.16); clip-path: var(--cham); padding: 12px 14px; }
.ms-h { font-size: 12px; letter-spacing: 3px; color: #9fb0cc; font-weight: 700; margin-bottom: 10px; }

.ms-stand { display: flex; flex-direction: column; gap: 9px; }
.ms-srow { display: grid; grid-template-columns: 14px 1fr auto; align-items: center; gap: 8px; position: relative; padding-bottom: 8px; }
.ms-srow.dead { opacity: .4; }
.ms-srow.me .ms-sname { color: #fff; font-weight: 700; }
.ms-sc { width: 12px; height: 12px; border-radius: 3px; }
.ms-sname { font-size: 14px; display: flex; align-items: center; gap: 6px; }
.ms-ai { font-size: 9px; background: rgba(120,150,190,.3); padding: 1px 4px; border-radius: 3px; letter-spacing: 1px; }
.ms-you { font-size: 9px; background: #56b9cf; color: #06222b; padding: 1px 4px; border-radius: 3px; letter-spacing: 1px; font-weight: 700; }
.ms-spct { font-family: 'Space Grotesk', monospace; font-size: 12px; color: #c2cee2; }
.ms-bar { grid-column: 1 / -1; height: 4px; background: rgba(255,255,255,.07); border-radius: 3px; overflow: hidden; }
.ms-bar > span { display: block; height: 100%; transition: width .5s ease; }

.ms-stances { display: flex; gap: 6px; }
.ms-stbtn { flex: 1; cursor: pointer; padding: 9px 4px; font-family: 'Oswald'; font-weight: 600; font-size: 12px;
  color: #8092b0; background: rgba(8,14,24,.5); border: 1px solid rgba(120,150,190,.18); clip-path: var(--cham); transition: all .12s; }
.ms-stbtn:hover { filter: brightness(1.2); }
.ms-stbtn.on { color: #06222b; background: #9be0ee; border-color: transparent; font-weight: 700; }

.ms-feedcard { flex: 1; min-height: 120px; }
.ms-feed { display: flex; flex-direction: column; gap: 6px; font-size: 13px; color: #c2cee2; max-height: 240px; overflow: auto; }
.ms-line { line-height: 1.4; border-left: 2px solid rgba(120,150,190,.3); padding-left: 8px; }

.ms-btn { position: relative; font-family: 'Oswald'; font-weight: 600; font-size: 13px; letter-spacing: 1px; cursor: pointer;
  padding: 8px 14px; color: #e9eef7; background: rgba(140,175,215,.30); border: none; clip-path: var(--cham); transition: transform .12s, filter .15s; }
.ms-btn::before { content: ""; position: absolute; inset: 1.5px; background: #101a28; clip-path: var(--cham); z-index: -1; }
.ms-btn:hover:not(:disabled) { transform: translateY(-1px); filter: brightness(1.15); }
.ms-btn:disabled { opacity: .5; cursor: not-allowed; }
.ms-ghost { background: rgba(150,180,225,.16); color: #9fb0cc; }
.ms-ghost::before { background: rgba(10,16,26,.5); }
.ms-danger { background: rgba(229,65,79,.5); color: #ffdde0; }
.ms-danger::before { background: linear-gradient(180deg,#a83843,#7e2730); }
.ms-primary { color: #06222b; font-weight: 700; background: #9be0ee; }
.ms-primary::before { background: linear-gradient(180deg,#74cee0,#3f9fb8); }

.ms-spin { width: 34px; height: 34px; border-radius: 50%; border: 3px solid rgba(120,150,190,.25); border-top-color: #56b9cf; animation: msSpin .8s linear infinite; }
@keyframes msSpin { to { transform: rotate(360deg); } }
.ms-skel-col { display: flex; flex-direction: column; gap: 8px; }
.ms-skel { height: 18px; border-radius: 4px; background: linear-gradient(90deg, rgba(120,150,190,.1) 25%, rgba(120,150,190,.22) 37%, rgba(120,150,190,.1) 63%); background-size: 400% 100%; animation: msShim 1.3s ease infinite; }
@keyframes msShim { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }

.ms-err { position: fixed; bottom: 14px; left: 50%; transform: translateX(-50%); z-index: 20;
  padding: 9px 14px; background: rgba(229,65,79,.16); border: 1px solid rgba(229,65,79,.4); color: #ff9aa2; clip-path: var(--cham); font-size: 13px; }

.ms-overlay { position: fixed; inset: 0; z-index: 30; display: flex; align-items: center; justify-content: center; background: rgba(4,8,14,.82); backdrop-filter: blur(6px); }
.ms-result { text-align: center; }
.ms-rk { font-size: clamp(36px,8vw,72px); font-weight: 700; letter-spacing: 6px; }
.ms-rsub { color: #9fb0cc; margin: 8px 0 22px; }
`;