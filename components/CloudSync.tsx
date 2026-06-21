"use client";
/**
 * CloudSync — headless cloud-save sync. components/CloudSync.tsx
 * Mount once near the app root (inside the page). For logged-in users it:
 *   - PULLS the cloud save on sign-in (once per session). If it differs from the
 *     local save, it writes it to localStorage and reloads so the store re-hydrates.
 *   - PUSHES the local save up whenever it changes (debounced poll + on hide/unload).
 * Guests are untouched (local-only saves). Renders a tiny "saved" badge.
 */
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth";
import { SAVE_KEY, readLocalSave, writeLocalSave, loadCloudSave, saveCloudSave } from "@/lib/cloudsave";

export default function CloudSync() {
  const { userId, loggedIn } = useAuth();
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const pulledFor = useRef<string | null>(null);   // uid we've already pulled for
  const lastPushed = useRef<string>("");           // last blob we sent up
  const pushTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  /* ---------- PULL on sign-in (once per session per user) ---------- */
  useEffect(() => {
    if (!loggedIn || !userId) return;
    const sessionFlag = `salient_pulled_${userId}`;
    if (pulledFor.current === userId || sessionStorage.getItem(sessionFlag)) return;
    pulledFor.current = userId;

    (async () => {
      try {
        const cloud = await loadCloudSave(userId);
        const local = readLocalSave();
        sessionStorage.setItem(sessionFlag, "1");
        if (cloud) {
          const cloudJson = JSON.stringify(cloud);
          if (cloudJson !== local) {
            // cloud is the source of truth on a fresh login → adopt it and reload
            writeLocalSave(cloudJson);
            lastPushed.current = cloudJson;
            location.reload();
            return;
          }
          lastPushed.current = cloudJson;
        } else if (local) {
          // first cloud save for this account → push the existing local progress
          await saveCloudSave(userId, JSON.parse(local));
          lastPushed.current = local;
        }
      } catch { /* offline / RLS — stay on local save */ }
    })();
  }, [loggedIn, userId]);

  /* ---------- PUSH on change (poll local save, debounce upload) ---------- */
  useEffect(() => {
    if (!loggedIn || !userId) return;

    const flush = () => {
      const local = readLocalSave();
      if (!local || local === lastPushed.current) return;
      setStatus("saving");
      saveCloudSave(userId, JSON.parse(local))
        .then(() => { lastPushed.current = local; setStatus("saved"); setTimeout(() => setStatus("idle"), 1200); })
        .catch(() => setStatus("idle"));
    };

    // debounced check every 4s — cheap, and the save blob is small
    const poll = setInterval(() => {
      const local = readLocalSave();
      if (!local || local === lastPushed.current) return;
      if (pushTimer.current) clearTimeout(pushTimer.current);
      pushTimer.current = setTimeout(flush, 600);
    }, 4000);

    const onHide = () => { if (document.visibilityState === "hidden") flush(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("beforeunload", flush);

    return () => {
      clearInterval(poll);
      if (pushTimer.current) clearTimeout(pushTimer.current);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("beforeunload", flush);
    };
  }, [loggedIn, userId]);

  if (status === "idle" || !loggedIn) return null;
  return (
    <div style={{
      position: "fixed", bottom: 12, right: 12, zIndex: 50,
      font: "600 11px 'Space Grotesk', monospace", letterSpacing: 1,
      padding: "5px 10px", borderRadius: 6, color: "#9be0ee",
      background: "rgba(8,14,24,.82)", border: "1px solid rgba(86,185,207,.4)",
    }}>
      {status === "saving" ? "☁ saving…" : "☁ saved"}
    </div>
  );
}