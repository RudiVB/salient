// lib/art.ts — shared unit artwork helpers.
// Used by BOTH the 3D battlefield (lib/sprites.ts) and the 2D builder cards
// (components/UnitArt.tsx) so a unit looks identical everywhere.

import { Kind } from "@/lib/catalog";

export const FACTION = {
  P: { body: "#7a7440", trim: "#9a8f4e", dark: "#3c3a22", skin: "#caa17c" }, // allied khaki
  E: { body: "#5e655a", trim: "#767d6e", dark: "#2c302a", skin: "#caa17c" }, // central field-grey
};

export const unitArtUrl = (id: string) => `/units/${id}.png`;

/** Draw a stylized placeholder silhouette into an existing 256x256 canvas. */
export function drawUnitPlaceholder(canvas: HTMLCanvasElement, kind: Kind, side: "P" | "E") {
  const S = 256;
  canvas.width = S; canvas.height = S;
  const ctx = canvas.getContext("2d")!;
  const col = FACTION[side];
  ctx.clearRect(0, 0, S, S);

  const grad = ctx.createLinearGradient(0, 0, 0, S);
  grad.addColorStop(0, col.trim); grad.addColorStop(1, col.dark);
  ctx.fillStyle = grad; ctx.strokeStyle = col.dark; ctx.lineWidth = 6; ctx.lineJoin = "round";
  const cx = S / 2;

  if (kind === "soldier" || kind === "gas") {
    ctx.fillRect(cx - 30, 150, 22, 80); ctx.fillRect(cx + 8, 150, 22, 80);
    rrect(ctx, cx - 34, 78, 68, 80, 10); ctx.fill();
    ctx.save(); ctx.translate(cx + 20, 95); ctx.rotate(-0.25); ctx.fillRect(0, -8, 110, 16); ctx.restore();
    ctx.fillStyle = "#241d12"; ctx.fillRect(cx + 30, 70, 120, 8); ctx.fillStyle = grad;
    if (kind === "gas") {
      ctx.beginPath(); ctx.arc(cx, 52, 30, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = "#1b1b15"; ctx.beginPath(); ctx.arc(cx + 14, 50, 7, 0, Math.PI * 2); ctx.fill();
      ctx.fillRect(cx + 8, 60, 26, 16);
    } else {
      ctx.fillStyle = col.skin; ctx.beginPath(); ctx.arc(cx, 54, 26, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = col.dark; ctx.beginPath(); ctx.arc(cx, 44, 30, Math.PI, Math.PI * 2); ctx.fill();
      ctx.fillRect(cx - 36, 40, 72, 8);
    }
  } else if (kind === "tank") {
    ctx.beginPath();
    ctx.moveTo(30, 200); ctx.lineTo(60, 130); ctx.lineTo(196, 130); ctx.lineTo(226, 200);
    ctx.lineTo(226, 220); ctx.lineTo(30, 220); ctx.closePath(); ctx.fill();
    rrect(ctx, cx - 30, 100, 60, 36, 6); ctx.fill();
    ctx.fillStyle = "#241d12"; ctx.fillRect(cx + 26, 112, 120, 10); ctx.fillStyle = "#161109";
    for (const x of [70, cx, 186]) { ctx.beginPath(); ctx.arc(x, 210, 10, 0, Math.PI * 2); ctx.fill(); }
  } else if (kind === "artillery") {
    ctx.lineWidth = 10;
    ctx.beginPath(); ctx.arc(96, 196, 34, 0, Math.PI * 2); ctx.stroke();
    ctx.beginPath(); ctx.arc(150, 196, 34, 0, Math.PI * 2); ctx.stroke();
    ctx.save(); ctx.translate(150, 150); ctx.rotate(-0.5); ctx.fillRect(0, -12, 150, 24); ctx.restore();
    ctx.fillRect(60, 190, 90, 14);
  } else if (kind === "plane") {
    rrect(ctx, 70, 116, 130, 28, 12); ctx.fill();
    ctx.fillRect(40, 96, 180, 12); ctx.fillRect(60, 150, 150, 12);
    ctx.fillRect(70, 96, 12, 56); ctx.fillRect(196, 96, 10, 30);
  } else if (kind === "medic") {
    // soldier body
    ctx.fillRect(cx - 30, 150, 22, 80); ctx.fillRect(cx + 8, 150, 22, 80);
    rrect(ctx, cx - 34, 78, 68, 80, 10); ctx.fill();
    ctx.save(); ctx.translate(cx + 20, 95); ctx.rotate(-0.25); ctx.fillRect(0, -8, 70, 16); ctx.restore();
    ctx.fillStyle = col.skin; ctx.beginPath(); ctx.arc(cx, 54, 26, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#e9e3d2"; ctx.beginPath(); ctx.arc(cx, 44, 30, Math.PI, Math.PI * 2); ctx.fill(); // white helmet
    ctx.fillRect(cx - 36, 40, 72, 8);
    // red cross on chest + helmet
    ctx.fillStyle = "#d6473f";
    ctx.fillRect(cx - 6, 92, 12, 36); ctx.fillRect(cx - 18, 104, 36, 12);
    ctx.fillRect(cx - 4, 30, 8, 20); ctx.fillRect(cx - 10, 36, 20, 8);
  } else if (kind === "car") {
    rrect(ctx, 40, 150, 176, 40, 8); ctx.fill();
    rrect(ctx, 70, 116, 60, 40, 6); ctx.fill();
    rrect(ctx, 140, 126, 30, 30, 4); ctx.fill();
    ctx.fillStyle = "#161109";
    ctx.beginPath(); ctx.arc(80, 196, 18, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(176, 196, 18, 0, Math.PI * 2); ctx.fill();
  }
}

export function rrect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
