// lib/sprites.ts — unit artwork loader for the 3D battlefield.
// Drop a transparent PNG at public/units/<id>.png (side-view, facing RIGHT).
// Images are PRELOADED (see preloadUnits + the auto-call at the bottom) so the
// first battle shows real art instead of the drawn placeholder.

import * as THREE from "three";
import { Kind, UNITS } from "@/lib/catalog";
import { drawUnitPlaceholder, unitArtUrl } from "@/lib/art";

const texCache = new Map<string, THREE.Texture>();   // keyed by `${id}_${side}`
const imgCache = new Map<string, HTMLImageElement>(); // one shared <img> per id

// Load (or reuse) the single shared image for a unit id.
function loadImage(id: string): HTMLImageElement {
  let img = imgCache.get(id);
  if (img) return img;
  img = new Image();
  img.src = unitArtUrl(id);          // browser HTTP-caches the download
  imgCache.set(id, img);
  return img;
}

// Warm every unit image up front. Safe to call repeatedly (idempotent).
export function preloadUnits(): void {
  if (typeof window === "undefined") return;
  for (const u of UNITS) loadImage(u.id);
}

export function getUnitTexture(id: string, kind: Kind, side: "P" | "E"): THREE.Texture {
  const key = `${id}_${side}`;
  const cached = texCache.get(key);
  if (cached) return cached;

  // start from the drawn placeholder so we always have *something*
  const canvas = document.createElement("canvas");
  drawUnitPlaceholder(canvas, kind, side);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (side === "E") {                // mirror to face LEFT (NPOT-safe: UVs stay in [0,1])
    tex.repeat.x = -1;
    tex.offset.x = 1;
  }
  texCache.set(key, tex);

  // swap the real PNG in — immediately if it's already downloaded
  const img = loadImage(id);
  const apply = () => { tex.image = img; tex.needsUpdate = true; };
  if (img.complete && img.naturalWidth > 0) {
    apply();
  } else {
    img.addEventListener("load", apply, { once: true });
    img.addEventListener("error", () => { /* keep placeholder */ }, { once: true });
  }
  return tex;
}

export function makeShadowTexture(): THREE.Texture {
  const c = document.createElement("canvas"); c.width = c.height = 128;
  const ctx = c.getContext("2d")!;
  const g = ctx.createRadialGradient(64, 64, 4, 64, 64, 60);
  g.addColorStop(0, "rgba(0,0,0,0.55)");
  g.addColorStop(1, "rgba(0,0,0,0)");
  ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Auto-warm on first import (runs when CampaignFront/BattleScene loads, i.e. before the battle).
preloadUnits();
