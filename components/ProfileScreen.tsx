"use client";
/**
 * ProfileScreen — player stats + global leaderboard. components/ProfileScreen.tsx
 * Two tabs: your profile (rating, W/L, win%, rank) and the top-100 ranks.
 * Logged-in only for the profile tab; leaderboard is public. Loaders throughout.
 *
 * Wiring (app/page.tsx): if (screen === "profile") return <ProfileScreen onBack={...} onAuth={...} />;
 */
import { useEffect, useState } from "react";
import { supabaseReady } from "@/lib/supabase";
import { useAuth, authUserId } from "@/lib/auth";
import { getMyProfile, getLeaderboard, type Profile, type LeaderRow } from "@/lib/profiles";

type Tab = "profile" | "ranks";

export default function ProfileScreen({ onBack, onAuth }: { onBack: () => void; onAuth?: () => void }) {
  const { loggedIn, username } = useAuth();
  const [tab, setTab] = useState<Tab>("profile");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [board, setBoard] = useState<LeaderRow[]>([]);
  const [loadingP, setLoadingP] = useState(true);
  const [loadingB, setLoadingB] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const myId = authUserId();

  // load profile when logged-in
  useEffect(() => {
    let alive = true;
    setLoadingP(true);
    getMyProfile().then((p) => { if (alive) setProfile(p); })
      .catch((e) => setError(msg(e))).finally(() => { if (alive) setLoadingP(false); });
    return () => { alive = false; };
  }, [loggedIn, username]);

  // load leaderboard always
  useEffect(() => {
    let alive = true;
    setLoadingB(true);
    getLeaderboard().then((b) => { if (alive) setBoard(b); })
      .catch((e) => setError(msg(e))).finally(() => { if (alive) setLoadingB(false); });
    return () => { alive = false; };
  }, []);

  const myRank = myId ? board.findIndex((r) => r.id === myId) + 1 : 0;   // 0 = unranked/not found
  const p = profile;
  const winPct = p && p.matches > 0 ? Math.round((100 * p.wins) / p.matches) : 0;

  return (
    <div className="pf-wrap">
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="pf-top">
        <button className="pf-btn pf-ghost" onClick={onBack}>◂ Back</button>
        <div className="pf-title">PROFILE &amp; RANKS</div>
        <div style={{ width: 80 }} />
      </div>

      <div className="pf-content">
        <div className="pf-tabs">
          <button className={"pf-tab" + (tab === "profile" ? " on" : "")} onClick={() => setTab("profile")}>My Profile</button>
          <button className={"pf-tab" + (tab === "ranks" ? " on" : "")} onClick={() => setTab("ranks")}>Leaderboard</button>
        </div>

        {/* ---------------- profile tab ---------------- */}
        {tab === "profile" && (
          !supabaseReady ? (
            <div className="pf-card pf-center"><div className="pf-muted">Backend not configured.</div></div>
          ) : !loggedIn ? (
            <div className="pf-card pf-center">
              <div className="pf-h">Sign in to track your record</div>
              <p className="pf-muted">Accounts earn a rating, win/loss record, and a spot on the leaderboard.</p>
              {onAuth && <button className="pf-btn pf-primary" onClick={onAuth}>Sign in / Register</button>}
            </div>
          ) : loadingP ? (
            <div className="pf-card pf-center"><div className="pf-spin" /><div className="pf-muted">Loading record…</div></div>
          ) : (
            <div className="pf-card">
              <div className="pf-name">{p?.username || username || "Commander"}</div>
              <div className="pf-rank">{myRank > 0 ? `Rank #${myRank}` : "Unranked"}</div>
              <div className="pf-stats">
                <Stat label="RATING" value={p?.rating ?? 1000} hi />
                <Stat label="WINS" value={p?.wins ?? 0} />
                <Stat label="LOSSES" value={p?.losses ?? 0} />
                <Stat label="MATCHES" value={p?.matches ?? 0} />
                <Stat label="WIN %" value={`${winPct}%`} />
              </div>
              {(!p || p.matches === 0) && <div className="pf-muted" style={{ marginTop: 14 }}>No matches yet — win a multiplayer war to climb the ranks.</div>}
            </div>
          )
        )}

        {/* ---------------- leaderboard tab ---------------- */}
        {tab === "ranks" && (
          <div className="pf-card">
            <div className="pf-h">TOP COMMANDERS</div>
            {loadingB ? (
              <div className="pf-skelcol">{[0,1,2,3,4].map((i) => <div key={i} className="pf-skel" />)}</div>
            ) : board.length === 0 ? (
              <div className="pf-center"><div className="pf-muted">No ranked players yet. Be the first!</div></div>
            ) : (
              <div className="pf-lb">
                <div className="pf-lbhead"><span>#</span><span>Commander</span><span>Rating</span><span>W-L</span><span>Win%</span></div>
                {board.map((r, i) => (
                  <div key={r.id} className={"pf-lbrow" + (r.id === myId ? " me" : "")}>
                    <span className="pf-pos">{medal(i + 1)}</span>
                    <span className="pf-cmd">{r.username || "Commander"}{r.id === myId && <span className="pf-youtag">YOU</span>}</span>
                    <span className="pf-rt">{r.rating}</span>
                    <span className="pf-wl">{r.wins}-{r.losses}</span>
                    <span className="pf-pct">{r.win_pct}%</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {error && <div className="pf-err">{error}</div>}
      </div>
    </div>
  );
}

function Stat({ label, value, hi }: { label: string; value: number | string; hi?: boolean }) {
  return (
    <div className="pf-stat">
      <div className={"pf-sv" + (hi ? " hi" : "")}>{value}</div>
      <div className="pf-sl">{label}</div>
    </div>
  );
}
function medal(n: number): string { return n === 1 ? "🥇" : n === 2 ? "🥈" : n === 3 ? "🥉" : String(n); }
function msg(e: unknown): string { return e instanceof Error ? e.message : "Something went wrong."; }

const CSS = `
.pf-wrap { min-height: 100vh; background: linear-gradient(180deg,#0a0f1a,#111c2e 60%,#16243a);
  font-family: 'Oswald', system-ui, sans-serif; color: #e9eef7;
  --cham: polygon(0 8px,8px 0,calc(100% - 8px) 0,100% 8px,100% calc(100% - 8px),calc(100% - 8px) 100%,8px 100%,0 calc(100% - 8px)); }
.pf-top { display: flex; align-items: center; justify-content: space-between; padding: 18px 20px; border-bottom: 1px solid rgba(120,150,190,.16); }
.pf-title { font-size: clamp(16px,3vw,24px); letter-spacing: 4px; color: #56b9cf; font-weight: 700; }
.pf-content { max-width: 640px; margin: 0 auto; padding: 22px 18px; }
.pf-tabs { display: flex; gap: 6px; margin-bottom: 16px; }
.pf-tab { flex: 1; cursor: pointer; padding: 10px; background: rgba(8,14,24,.5); border: 1px solid rgba(120,150,190,.18); color: #8092b0; font-family: 'Oswald'; font-weight: 600; letter-spacing: 1px; clip-path: var(--cham); }
.pf-tab.on { color: #06222b; background: #9be0ee; border-color: transparent; }
.pf-card { position: relative; background: rgba(140,175,215,.10); border: 1px solid rgba(120,150,190,.18); clip-path: var(--cham); padding: 20px; }
.pf-center { display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center; }
.pf-h { font-size: 13px; letter-spacing: 3px; color: #9fb0cc; font-weight: 700; margin-bottom: 8px; }
.pf-muted { color: #8092b0; font-size: 13px; }
.pf-name { font-size: 26px; font-weight: 700; color: #9be0ee; }
.pf-rank { color: #f0c860; font-family: 'Space Grotesk', monospace; letter-spacing: 2px; margin: 4px 0 18px; }
.pf-stats { display: grid; grid-template-columns: repeat(5,1fr); gap: 10px; }
@media (max-width: 560px) { .pf-stats { grid-template-columns: repeat(2,1fr); } }
.pf-stat { background: rgba(8,14,24,.5); border: 1px solid rgba(120,150,190,.14); clip-path: var(--cham); padding: 12px 8px; text-align: center; }
.pf-sv { font-size: 24px; font-weight: 700; font-family: 'Space Grotesk', monospace; }
.pf-sv.hi { color: #f0c860; }
.pf-sl { font-size: 10px; letter-spacing: 2px; color: #8092b0; margin-top: 4px; }

.pf-lb { display: flex; flex-direction: column; gap: 2px; }
.pf-lbhead, .pf-lbrow { display: grid; grid-template-columns: 44px 1fr 70px 64px 56px; align-items: center; gap: 6px; padding: 9px 8px; }
.pf-lbhead { font-size: 10px; letter-spacing: 2px; color: #6f7f9c; border-bottom: 1px solid rgba(120,150,190,.16); }
.pf-lbrow { background: rgba(8,14,24,.35); border: 1px solid transparent; clip-path: var(--cham); }
.pf-lbrow.me { border-color: #56b9cf; background: rgba(86,185,207,.12); }
.pf-pos { font-size: 15px; }
.pf-cmd { font-weight: 600; font-size: 14px; display: flex; align-items: center; gap: 6px; }
.pf-youtag { font-size: 9px; background: #56b9cf; color: #06222b; padding: 1px 4px; border-radius: 3px; letter-spacing: 1px; font-weight: 700; }
.pf-rt { font-family: 'Space Grotesk', monospace; color: #f0c860; font-weight: 700; }
.pf-wl, .pf-pct { font-family: 'Space Grotesk', monospace; font-size: 13px; color: #c2cee2; }

.pf-btn { position: relative; font-family: 'Oswald'; font-weight: 600; font-size: 14px; letter-spacing: 1px; cursor: pointer; padding: 11px 18px; margin-top: 8px; color: #e9eef7; background: rgba(140,175,215,.30); border: none; clip-path: var(--cham); transition: transform .12s, filter .15s; }
.pf-btn::before { content: ""; position: absolute; inset: 1.5px; background: #101a28; clip-path: var(--cham); z-index: -1; }
.pf-btn:hover { transform: translateY(-2px); filter: brightness(1.14); }
.pf-primary { color: #06222b; font-weight: 700; background: #9be0ee; }
.pf-primary::before { background: linear-gradient(180deg,#74cee0,#3f9fb8); }
.pf-ghost { background: rgba(150,180,225,.16); color: #9fb0cc; margin-top: 0; }
.pf-ghost::before { background: rgba(10,16,26,.5); }

.pf-spin { width: 32px; height: 32px; border-radius: 50%; border: 3px solid rgba(120,150,190,.25); border-top-color: #56b9cf; animation: pfSpin .8s linear infinite; }
@keyframes pfSpin { to { transform: rotate(360deg); } }
.pf-skelcol { display: flex; flex-direction: column; gap: 8px; }
.pf-skel { height: 34px; clip-path: var(--cham); background: linear-gradient(90deg, rgba(120,150,190,.1) 25%, rgba(120,150,190,.22) 37%, rgba(120,150,190,.1) 63%); background-size: 400% 100%; animation: pfShim 1.3s ease infinite; }
@keyframes pfShim { 0% { background-position: 100% 0; } 100% { background-position: -100% 0; } }
.pf-err { margin-top: 14px; padding: 10px 12px; background: rgba(229,65,79,.14); border: 1px solid rgba(229,65,79,.4); color: #ff9aa2; clip-path: var(--cham); font-size: 13px; }
`;