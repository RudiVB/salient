"use client";
/**
 * AuthScreen — register / login / play as guest. components/AuthScreen.tsx
 * Accounts give cloud saves + a named identity in lobbies. Guests play locally.
 * Wiring (app/page.tsx): if (screen === "auth") return <AuthScreen onBack={...} onDone={...} />;
 */
import { useState } from "react";
import { supabaseReady } from "@/lib/supabase";
import { useAuth, signIn, signUp, signOut, displayName } from "@/lib/auth";

type Mode = "login" | "register";

export default function AuthScreen({ onBack, onDone }: { onBack: () => void; onDone: () => void }) {
  const { loggedIn, username, loading } = useAuth();
  const [mode, setMode] = useState<Mode>("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [uname, setUname] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  async function submit() {
    setError(null); setInfo(null);
    if (!email.trim() || !password) { setError("Email and password are required."); return; }
    if (mode === "register" && !uname.trim()) { setError("Choose a commander name."); return; }
    setBusy(true);
    try {
      const res = mode === "register"
        ? await signUp(email, password, uname.trim())
        : await signIn(email, password);
      if (!res.ok) { setError(res.error || "Authentication failed."); return; }
      if (res.needsConfirm) { setInfo("Check your email to confirm your account, then log in."); setMode("login"); return; }
      onDone();
    } finally { setBusy(false); }
  }

  return (
    <div className="au-wrap">
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="au-top">
        <button className="au-btn au-ghost" onClick={onBack}>◂ Back</button>
        <div className="au-title">ACCOUNT</div>
        <div style={{ width: 80 }} />
      </div>

      <div className="au-content">
        {!supabaseReady ? (
          <div className="au-card">
            <div className="au-h">Backend not configured</div>
            <p className="au-muted">Set <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to enable accounts.</p>
            <button className="au-btn au-primary" onClick={onDone}>Continue as Guest</button>
          </div>
        ) : loading ? (
          <div className="au-card au-center"><div className="au-spin" /><div className="au-muted">Checking session…</div></div>
        ) : loggedIn ? (
          // already signed in
          <div className="au-card au-center">
            <div className="au-h">Signed in</div>
            <div className="au-big">{username || displayName()}</div>
            <p className="au-muted">Your progress now syncs to the cloud.</p>
            <button className="au-btn au-primary" onClick={onDone}>Continue</button>
            <button className="au-btn au-ghost" disabled={busy} onClick={async () => { setBusy(true); await signOut(); setBusy(false); }}>
              Sign out
            </button>
          </div>
        ) : (
          // login / register form
          <div className="au-card">
            <div className="au-tabs">
              <button className={"au-tab" + (mode === "login" ? " on" : "")} onClick={() => { setMode("login"); setError(null); }}>Log in</button>
              <button className={"au-tab" + (mode === "register" ? " on" : "")} onClick={() => { setMode("register"); setError(null); }}>Register</button>
            </div>

            {mode === "register" && (
              <>
                <label className="au-lbl">Commander name</label>
                <input className="au-input" value={uname} maxLength={20} placeholder="Gen. Smuts"
                  onChange={(e) => setUname(e.target.value)} />
              </>
            )}
            <label className="au-lbl">Email</label>
            <input className="au-input" type="email" value={email} placeholder="you@example.com"
              onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            <label className="au-lbl">Password</label>
            <input className="au-input" type="password" value={password} placeholder="••••••••"
              onChange={(e) => setPassword(e.target.value)}
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              onKeyDown={(e) => { if (e.key === "Enter") submit(); }} />

            {error && <div className="au-err">{error}</div>}
            {info && <div className="au-info">{info}</div>}

            <button className="au-btn au-primary" disabled={busy} onClick={submit}>
              {busy ? (mode === "register" ? "Creating…" : "Signing in…") : (mode === "register" ? "Create account" : "Log in")}
            </button>
            <button className="au-btn au-ghost" disabled={busy} onClick={onDone}>Play as guest</button>
          </div>
        )}
      </div>
    </div>
  );
}

const CSS = `
.au-wrap { min-height: 100vh; background: linear-gradient(180deg,#0a0f1a,#111c2e 60%,#16243a);
  font-family: 'Oswald', system-ui, sans-serif; color: #e9eef7;
  --cham: polygon(0 8px,8px 0,calc(100% - 8px) 0,100% 8px,100% calc(100% - 8px),calc(100% - 8px) 100%,8px 100%,0 calc(100% - 8px)); }
.au-top { display: flex; align-items: center; justify-content: space-between; padding: 18px 20px; border-bottom: 1px solid rgba(120,150,190,.16); }
.au-title { font-size: clamp(18px,3vw,24px); letter-spacing: 5px; color: #56b9cf; font-weight: 700; }
.au-content { max-width: 440px; margin: 0 auto; padding: 30px 18px; }
.au-card { position: relative; background: rgba(140,175,215,.10); border: 1px solid rgba(120,150,190,.18); clip-path: var(--cham); padding: 22px; }
.au-center { display: flex; flex-direction: column; align-items: center; gap: 12px; text-align: center; }
.au-h { font-size: 13px; letter-spacing: 3px; color: #9fb0cc; font-weight: 700; margin-bottom: 6px; }
.au-big { font-size: 24px; font-weight: 700; color: #9be0ee; }
.au-muted { color: #8092b0; font-size: 13px; }
.au-muted code { color: #f0c860; font-family: 'Space Grotesk', monospace; font-size: 12px; }
.au-tabs { display: flex; gap: 6px; margin-bottom: 16px; }
.au-tab { flex: 1; cursor: pointer; padding: 9px; background: rgba(8,14,24,.5); border: 1px solid rgba(120,150,190,.18);
  color: #8092b0; font-family: 'Oswald'; font-weight: 600; letter-spacing: 1px; clip-path: var(--cham); }
.au-tab.on { color: #06222b; background: #9be0ee; border-color: transparent; }
.au-lbl { display: block; font-size: 11px; letter-spacing: 2px; color: #8092b0; margin: 12px 0 5px; }
.au-input { width: 100%; background: rgba(8,14,24,.7); border: 1px solid rgba(120,150,190,.25); color: #e9eef7;
  font-family: 'Oswald'; font-size: 15px; padding: 11px 12px; clip-path: var(--cham); outline: none; }
.au-input:focus { border-color: #56b9cf; }
.au-btn { position: relative; width: 100%; font-family: 'Oswald'; font-weight: 600; font-size: 15px; letter-spacing: 1px;
  cursor: pointer; padding: 12px 16px; margin-top: 12px; color: #e9eef7; background: rgba(140,175,215,.30); border: none; clip-path: var(--cham); transition: transform .12s, filter .15s; }
.au-btn::before { content: ""; position: absolute; inset: 1.5px; background: #101a28; clip-path: var(--cham); z-index: -1; }
.au-btn:hover:not(:disabled) { transform: translateY(-2px); filter: brightness(1.14); }
.au-btn:disabled { opacity: .5; cursor: not-allowed; }
.au-primary { color: #06222b; font-weight: 700; background: #9be0ee; }
.au-primary::before { background: linear-gradient(180deg,#74cee0,#3f9fb8); }
.au-ghost { background: rgba(150,180,225,.16); color: #9fb0cc; }
.au-ghost::before { background: rgba(10,16,26,.5); }
.au-err { margin-top: 12px; padding: 9px 12px; background: rgba(229,65,79,.14); border: 1px solid rgba(229,65,79,.4); color: #ff9aa2; clip-path: var(--cham); font-size: 13px; }
.au-info { margin-top: 12px; padding: 9px 12px; background: rgba(103,201,138,.12); border: 1px solid rgba(103,201,138,.4); color: #9be8b6; clip-path: var(--cham); font-size: 13px; }
.au-spin { width: 32px; height: 32px; border-radius: 50%; border: 3px solid rgba(120,150,190,.25); border-top-color: #56b9cf; animation: auSpin .8s linear infinite; }
@keyframes auSpin { to { transform: rotate(360deg); } }
`;