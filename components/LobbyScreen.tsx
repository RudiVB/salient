"use client";
/**
 * LobbyScreen — multiplayer lobby slice. components/LobbyScreen.tsx
 * Create a session (short join code) or join by code → pick a faction seat,
 * choose a nation, ready up. Host fills empty seats with AI and starts the war.
 * All seats update live via Supabase Realtime. Loaders on every async phase.
 *
 * Wiring (app/page.tsx):
 *   if (screen === "lobby") return (
 *     <LobbyScreen onBack={() => setScreen("menu")}
 *       onStart={({ sessionId, seat, code }) => { /* hand off to match *\/ setScreen("hub"); }} />
 *   );
 */
import { useCallback, useEffect, useRef, useState } from "react";
import { NATIONS } from "@/lib/nations";
import { supabaseReady } from "@/lib/supabase";
import {
  SEATS, SEAT_INFO, type Seat, type SessionRow, type PlayerRow,
  getUid, getName, setName,
  createSession, joinSession, fetchPlayers, switchSeat, chooseNation, setReady,
  leaveSession, startGame, allReady, subscribeLobby,
} from "@/lib/lobby";
import type { RealtimeChannel } from "@supabase/supabase-js";

type Phase = "menu" | "connecting" | "lobby";

export default function LobbyScreen({
  onBack, onStart,
}: {
  onBack: () => void;
  onStart: (info: { sessionId: string; seat: Seat; code: string }) => void;
}) {
  const [phase, setPhase] = useState<Phase>("menu");
  const [name, setNameState] = useState("Commander");
  const [code, setCode] = useState("");                 // join-code input
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);        // any write in flight

  const [session, setSession] = useState<SessionRow | null>(null);
  const [mySeat, setMySeat] = useState<Seat | null>(null);
  const [players, setPlayers] = useState<PlayerRow[]>([]);
  const [loadingPlayers, setLoadingPlayers] = useState(true);
  const [nationOpen, setNationOpen] = useState(false);

  const channelRef = useRef<RealtimeChannel | null>(null);
  const startedRef = useRef(false);                     // guard against double onStart

  const uid = typeof window !== "undefined" ? getUid() : "ssr";
  useEffect(() => { setNameState(getName()); }, []);    // hydrate name client-side

  /* ---------------- realtime + initial load once in a lobby ---------------- */
  const reloadPlayers = useCallback(async (sessionId: string) => {
    try { setPlayers(await fetchPlayers(sessionId)); }
    catch (e) { setError(msg(e)); }
    finally { setLoadingPlayers(false); }
  }, []);

  useEffect(() => {
    if (phase !== "lobby" || !session) return;
    setLoadingPlayers(true);
    reloadPlayers(session.id);
    // subscribe: any seat change reloads; a session UPDATE may flip status → start
    channelRef.current = subscribeLobby(
      session.id,
      () => reloadPlayers(session.id),
      (s) => {
        setSession(s);
        if (s.status === "active" && !startedRef.current && mySeat) {
          startedRef.current = true;
          onStart({ sessionId: s.id, seat: mySeat, code: s.code });
        }
      }
    );
    return () => { channelRef.current?.unsubscribe(); channelRef.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, session?.id]);

  /* ---------------- actions ---------------- */
  async function doCreate() {
    setError(null); setPending(true);
    try {
      setName(name);
      const { session: s, seat } = await createSession();
      setSession(s); setMySeat(seat); setPhase("lobby");
    } catch (e) { setError(msg(e)); setPhase("menu"); }
    finally { setPending(false); }
  }
  async function doJoin() {
    if (!code.trim()) { setError("Enter a join code."); return; }
    setError(null); setPending(true); setPhase("connecting");
    try {
      setName(name);
      const { session: s, seat } = await joinSession(code);
      setSession(s); setMySeat(seat); setPhase("lobby");
    } catch (e) { setError(msg(e)); setPhase("menu"); }
    finally { setPending(false); }
  }
  async function doSwitch(seat: Seat) {
    if (!session || pending) return;
    setPending(true);
    try { const ok = await switchSeat(session.id, seat); if (ok) setMySeat(seat); else setError("Seat just got taken."); }
    catch (e) { setError(msg(e)); }
    finally { setPending(false); }
  }
  async function doNation(nation: string) {
    if (!session) return;
    setNationOpen(false); setPending(true);
    try { await chooseNation(session.id, nation); }
    catch (e) { setError(msg(e)); }
    finally { setPending(false); }
  }
  async function doReady(next: boolean) {
    if (!session) return;
    setPending(true);
    try { await setReady(session.id, next); }
    catch (e) { setError(msg(e)); }
    finally { setPending(false); }
  }
  async function doStart() {
    if (!session) return;
    setPending(true);
    try { await startGame(session.id); }  // realtime status flip drives everyone's onStart
    catch (e) { setError(msg(e)); }
    finally { setPending(false); }
  }
  async function doLeave() {
    setPending(true);
    try { if (session) await leaveSession(session.id); }
    catch (e) { /* leaving anyway */ }
    finally {
      channelRef.current?.unsubscribe(); channelRef.current = null;
      setSession(null); setMySeat(null); setPlayers([]); setPending(false); setPhase("menu");
    }
  }

  /* ---------------- derived ---------------- */
  const me = players.find((p) => p.user_id === uid) || null;
  const isHost = !!session && session.host_id === uid;
  const humans = players.filter((p) => !p.is_ai).length;
  const ready = allReady(players);
  const bySeat = (seat: Seat) => players.find((p) => p.seat === seat) || null;

  /* ---------------- render: not configured ---------------- */
  if (!supabaseReady) {
    return (
      <Shell onBack={onBack} title="MULTIPLAYER">
        <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="lb-card lb-note">
          <div className="lb-h">Backend not configured</div>
          <p>Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in your Vercel
            environment (or <code>.env.local</code>) to enable online lobbies.</p>
          <button className="lb-btn" onClick={onBack}>Back</button>
        </div>
      </Shell>
    );
  }

  /* ---------------- render: connecting spinner ---------------- */
  if (phase === "connecting") {
    return (
      <Shell onBack={doLeave} title="MULTIPLAYER">
        <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="lb-card lb-center">
          <Spinner /><div className="lb-muted">Joining lobby…</div>
        </div>
      </Shell>
    );
  }

  /* ---------------- render: create / join menu ---------------- */
  if (phase === "menu") {
    return (
      <Shell onBack={onBack} title="MULTIPLAYER">
        <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: CSS }} />
        <div className="lb-grid2">
          <div className="lb-card">
            <div className="lb-h">Your name</div>
            <input className="lb-input" value={name} maxLength={20}
              onChange={(e) => setNameState(e.target.value)} placeholder="Commander" />
            <div className="lb-h" style={{ marginTop: 18 }}>Host a war</div>
            <p className="lb-muted">Create a lobby and share the code. Up to 4 players; AI fills the rest.</p>
            <button className="lb-btn lb-primary" disabled={pending} onClick={doCreate}>
              {pending ? "Creating…" : "Create Lobby"}
            </button>
          </div>
          <div className="lb-card">
            <div className="lb-h">Join a war</div>
            <p className="lb-muted">Enter a 5-letter code from your host.</p>
            <input className="lb-input lb-code" value={code} maxLength={5}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              placeholder="ABCDE" onKeyDown={(e) => { if (e.key === "Enter") doJoin(); }} />
            <button className="lb-btn" disabled={pending} onClick={doJoin}>
              {pending ? "Joining…" : "Join Lobby"}
            </button>
          </div>
        </div>
        {error && <div className="lb-err">{error}</div>}
      </Shell>
    );
  }

  /* ---------------- render: lobby ---------------- */
  return (
    <Shell onBack={doLeave} backLabel="Leave" title="WAR LOBBY">
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: CSS }} />

      {/* code banner */}
      <div className="lb-codebar">
        <div>
          <div className="lb-muted" style={{ fontSize: 11, letterSpacing: 3 }}>JOIN CODE</div>
          <div className="lb-codebig">{session?.code || "—"}</div>
        </div>
        <button className="lb-btn lb-ghost" onClick={() => session && navigator.clipboard?.writeText(session.code)}>Copy</button>
      </div>

      {/* seat grid (skeleton while first load resolves) */}
      <div className="lb-seats">
        {SEATS.map((seat) => {
          const info = SEAT_INFO[seat];
          const occ = bySeat(seat);
          const isMine = occ?.user_id === uid;
          const empty = !occ;
          return (
            <div key={seat}
              className={"lb-seat" + (isMine ? " mine" : "") + (empty ? " empty" : "")}
              style={{ ["--c" as string]: info.color }}>
              <div className="lb-seatbar" />
              <div className="lb-faction">{info.name}</div>
              {loadingPlayers ? (
                <div className="lb-skel" />
              ) : occ ? (
                <>
                  <div className="lb-occ">
                    {occ.display_name || "Player"}{occ.is_ai && <span className="lb-ai">AI</span>}
                    {session?.host_id === occ.user_id && <span className="lb-crown" title="Host">★</span>}
                  </div>
                  <div className="lb-nat">{occ.nation ? nationName(occ.nation) : <span className="lb-muted">choosing nation…</span>}</div>
                  <div className={"lb-status " + (occ.ready ? "on" : "")}>{occ.ready ? "READY" : "not ready"}</div>
                </>
              ) : (
                <>
                  <div className="lb-open">Open seat</div>
                  <button className="lb-btn lb-tiny" disabled={pending || !!me === false} onClick={() => doSwitch(seat)}>Move here</button>
                </>
              )}
            </div>
          );
        })}
      </div>

      {/* my controls */}
      <div className="lb-card lb-mine">
        {loadingPlayers ? (
          <div className="lb-center"><Spinner /></div>
        ) : me ? (
          <div className="lb-row">
            <div>
              <div className="lb-muted" style={{ fontSize: 11, letterSpacing: 2 }}>YOUR FACTION</div>
              <div className="lb-faction" style={{ ["--c" as string]: SEAT_INFO[me.seat].color, color: SEAT_INFO[me.seat].color }}>
                {SEAT_INFO[me.seat].name}
              </div>
            </div>
            <div className="lb-actions">
              <button className="lb-btn lb-ghost" disabled={pending} onClick={() => setNationOpen(true)}>
                {me.nation ? nationName(me.nation) : "Choose Nation"}
              </button>
              <button className={"lb-btn " + (me.ready ? "lb-warn" : "lb-primary")}
                disabled={pending || !me.nation} title={!me.nation ? "Choose a nation first" : ""}
                onClick={() => doReady(!me.ready)}>
                {me.ready ? "Unready" : "Ready"}
              </button>
            </div>
          </div>
        ) : (
          <div className="lb-muted">You have left this lobby.</div>
        )}
      </div>

      {/* host start / waiting */}
      <div className="lb-footer">
        <div className="lb-muted">{humans} human{humans === 1 ? "" : "s"} · {4 - humans} AI will fill</div>
        {isHost ? (
          <button className="lb-btn lb-primary lb-start" disabled={pending || !ready} onClick={doStart}>
            {pending ? "Starting…" : ready ? "Start War" : "Waiting for players…"}
          </button>
        ) : (
          <div className="lb-muted">{ready ? "All ready — waiting for host to start…" : "Waiting for everyone to ready up…"}</div>
        )}
      </div>

      {error && <div className="lb-err">{error}</div>}

      {/* nation picker */}
      {nationOpen && (
        <div className="lb-modal" onClick={() => setNationOpen(false)}>
          <div className="lb-panel" onClick={(e) => e.stopPropagation()}>
            <div className="lb-h">CHOOSE YOUR NATION</div>
            <div className="lb-natgrid">
              {NATIONS.map((n) => (
                <button key={n.id} className="lb-natbtn" style={{ ["--a" as string]: n.accent }}
                  onClick={() => doNation(n.id)}>
                  <span className="lb-natdot" />
                  <span className="lb-natname">{n.name}</span>
                  <span className="lb-natperk">{n.perkTitle}</span>
                </button>
              ))}
            </div>
            <button className="lb-btn lb-ghost" style={{ width: "100%", marginTop: 10 }} onClick={() => setNationOpen(false)}>Cancel</button>
          </div>
        </div>
      )}
    </Shell>
  );
}

/* ---------------- helpers ---------------- */
function nationName(id: string): string { return NATIONS.find((n) => n.id === id)?.name || id; }
function msg(e: unknown): string { return e instanceof Error ? e.message : "Something went wrong."; }

function Spinner() { return <div className="lb-spin" aria-label="loading" />; }

// Shared frame: title bar + back button + content slot.
function Shell({ children, onBack, title, backLabel = "Back" }: {
  children: React.ReactNode; onBack: () => void; title: string; backLabel?: string;
}) {
  return (
    <div className="lb-wrap">
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="lb-top">
        <button className="lb-btn lb-ghost" onClick={onBack}>◂ {backLabel}</button>
        <div className="lb-title">{title}</div>
        <div style={{ width: 90 }} />
      </div>
      <div className="lb-content">{children}</div>
    </div>
  );
}

const CSS = `
.lb-wrap { min-height: 100vh; background: linear-gradient(180deg,#0a0f1a,#111c2e 60%,#16243a);
  font-family: 'Oswald', system-ui, sans-serif; color: #e9eef7; padding: 0 0 40px;
  --cham: polygon(0 8px,8px 0,calc(100% - 8px) 0,100% 8px,100% calc(100% - 8px),calc(100% - 8px) 100%,8px 100%,0 calc(100% - 8px)); }
.lb-top { display: flex; align-items: center; justify-content: space-between; padding: 18px 20px;
  border-bottom: 1px solid rgba(120,150,190,.16); }
.lb-title { font-size: clamp(18px,3vw,26px); letter-spacing: 5px; color: #56b9cf; font-weight: 700; }
.lb-content { max-width: 900px; margin: 0 auto; padding: 22px 18px; }

.lb-grid2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
@media (max-width: 680px) { .lb-grid2 { grid-template-columns: 1fr; } }

.lb-card { position: relative; background: rgba(140,175,215,.10); border: 1px solid rgba(120,150,190,.18);
  clip-path: var(--cham); padding: 18px; }
.lb-h { font-size: 13px; letter-spacing: 3px; color: #9fb0cc; font-weight: 700; margin-bottom: 8px; }
.lb-muted { color: #8092b0; font-size: 13px; }
.lb-note p { color: #c2cee2; line-height: 1.6; font-size: 14px; }
.lb-note code { color: #f0c860; font-family: 'Space Grotesk', monospace; font-size: 12px; }

.lb-input { width: 100%; background: rgba(8,14,24,.7); border: 1px solid rgba(120,150,190,.25); color: #e9eef7;
  font-family: 'Oswald', sans-serif; font-size: 15px; padding: 11px 12px; clip-path: var(--cham); outline: none; }
.lb-input:focus { border-color: #56b9cf; }
.lb-code { letter-spacing: 8px; text-align: center; font-size: 22px; font-family: 'Space Grotesk', monospace; }

.lb-btn { position: relative; font-family: 'Oswald', sans-serif; font-weight: 600; font-size: 14px; letter-spacing: 1px;
  cursor: pointer; padding: 11px 16px; margin-top: 12px; color: #e9eef7; background: rgba(140,175,215,.30);
  border: none; clip-path: var(--cham); transition: transform .12s, filter .15s; }
.lb-btn::before { content: ""; position: absolute; inset: 1.5px; background: #101a28; clip-path: var(--cham); z-index: -1; }
.lb-btn:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.15); }
.lb-btn:disabled { opacity: .45; cursor: not-allowed; }
.lb-primary { color: #06222b; font-weight: 700; background: #9be0ee; }
.lb-primary::before { background: linear-gradient(180deg,#74cee0,#3f9fb8); }
.lb-warn { background: #f0c860; color: #2a2206; }
.lb-warn::before { background: linear-gradient(180deg,#e6bb4a,#caa033); }
.lb-ghost { background: rgba(150,180,225,.16); color: #9fb0cc; margin-top: 0; }
.lb-ghost::before { background: rgba(10,16,26,.5); }
.lb-tiny { padding: 7px 12px; font-size: 12px; }

.lb-err { margin-top: 14px; padding: 10px 12px; background: rgba(229,65,79,.14); border: 1px solid rgba(229,65,79,.4);
  color: #ff9aa2; clip-path: var(--cham); font-size: 13px; }

.lb-codebar { display: flex; align-items: center; justify-content: space-between; gap: 12px;
  background: rgba(8,14,24,.5); border: 1px solid rgba(120,150,190,.18); clip-path: var(--cham); padding: 12px 16px; margin-bottom: 16px; }
.lb-codebig { font-family: 'Space Grotesk', monospace; font-size: 30px; letter-spacing: 8px; color: #f0c860; }

.lb-seats { display: grid; grid-template-columns: repeat(4,1fr); gap: 12px; margin-bottom: 16px; }
@media (max-width: 680px) { .lb-seats { grid-template-columns: 1fr 1fr; } }
.lb-seat { position: relative; background: rgba(140,175,215,.08); border: 1px solid rgba(120,150,190,.16);
  clip-path: var(--cham); padding: 14px 12px 12px; min-height: 138px; overflow: hidden; }
.lb-seat.mine { border-color: var(--c); box-shadow: 0 0 0 1px var(--c) inset; }
.lb-seat.empty { opacity: .8; }
.lb-seatbar { position: absolute; top: 0; left: 0; right: 0; height: 4px; background: var(--c); }
.lb-faction { font-weight: 700; font-size: 14px; letter-spacing: .5px; margin-bottom: 8px; }
.lb-occ { font-size: 15px; font-weight: 600; display: flex; align-items: center; gap: 6px; }
.lb-ai { font-size: 10px; background: rgba(120,150,190,.3); padding: 1px 5px; border-radius: 3px; letter-spacing: 1px; }
.lb-crown { color: #f0c860; }
.lb-nat { font-size: 12px; color: #c2cee2; margin: 4px 0 8px; }
.lb-status { font-size: 11px; letter-spacing: 2px; color: #6f7f9c; }
.lb-status.on { color: #67c98a; font-weight: 700; }
.lb-open { font-size: 13px; color: #6f7f9c; margin-bottom: 10px; }
.lb-skel { height: 56px; margin-top: 6px; border-radius: 4px;
  background: linear-gradient(90deg, rgba(120,150,190,.10) 25%, rgba(120,150,190,.22) 37%, rgba(120,150,190,.10) 63%);
  background-size: 400% 100%; animation: lbShimmer 1.3s ease infinite; }
@keyframes lbShimmer { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }

.lb-mine { margin-bottom: 16px; }
.lb-row { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap; }
.lb-actions { display: flex; gap: 10px; }
.lb-actions .lb-btn { margin-top: 0; }

.lb-footer { display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap;
  border-top: 1px solid rgba(120,150,190,.16); padding-top: 16px; }
.lb-start { min-width: 200px; }

.lb-center { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 20px; }
.lb-spin { width: 34px; height: 34px; border-radius: 50%; border: 3px solid rgba(120,150,190,.25);
  border-top-color: #56b9cf; animation: lbSpin .8s linear infinite; }
@keyframes lbSpin { to { transform: rotate(360deg); } }

.lb-modal { position: fixed; inset: 0; z-index: 30; display: flex; align-items: center; justify-content: center;
  background: rgba(4,8,14,.72); backdrop-filter: blur(4px); padding: 18px; }
.lb-panel { width: min(620px,100%); max-height: 84vh; overflow: auto; background: rgba(140,175,215,.12);
  border: 1px solid rgba(120,150,190,.22); clip-path: var(--cham); padding: 20px; }
.lb-natgrid { display: grid; grid-template-columns: repeat(2,1fr); gap: 8px; }
@media (max-width: 560px) { .lb-natgrid { grid-template-columns: 1fr; } }
.lb-natbtn { display: flex; align-items: center; gap: 10px; text-align: left; cursor: pointer;
  background: rgba(8,14,24,.5); border: 1px solid rgba(120,150,190,.18); clip-path: var(--cham); padding: 10px 12px;
  color: #e9eef7; font-family: 'Oswald', sans-serif; transition: transform .1s, border-color .15s; }
.lb-natbtn:hover { transform: translateY(-1px); border-color: var(--a); }
.lb-natdot { width: 12px; height: 12px; border-radius: 50%; background: var(--a); flex: 0 0 auto; }
.lb-natname { font-weight: 600; font-size: 14px; flex: 1; }
.lb-natperk { font-size: 11px; color: #8092b0; letter-spacing: .5px; }
`;