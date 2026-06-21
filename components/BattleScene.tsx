"use client";
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { CATALOG, fmt } from "@/lib/catalog";
import { getUnitTexture, makeShadowTexture } from "@/lib/sprites";
import { playSfx } from "@/lib/audio";

/**
 * BattleScene — animated low-poly clash with ordered formations.
 * components/BattleScene.tsx
 * Visual only; the outcome (won) is decided by the caller.
 * Props: player[], enemy[] ({defId,troops}), accent, won, rungName, onDone()
 *
 * Tip: drop /units/<id>_enemy.png to give the enemy a distinct look; otherwise
 * the enemy uses the mirrored player art on a red-marked line.
 */
interface Force { defId: string; troops: number; }
const RANK: Record<string, number> = { soldier: 0, gas: 0, medic: 1, car: 1, recon: 1, plane: 2, artillery: 2, tank: 2 };

interface Ability { id: string; icon: string; name: string; effort: number; fx: string; }
const ABILITIES: Ability[] = [
  { id: "barrage", icon: "💥", name: "Barrage", effort: 13, fx: "barrage" },
  { id: "gas",     icon: "☁️", name: "Gas",     effort: 12, fx: "gas" },
  { id: "flank",   icon: "➡", name: "Flank",   effort: 13, fx: "flank" },
  { id: "rally",   icon: "🚩", name: "Rally",   effort: 10, fx: "rally" },
];

// per-terrain battlefield look — keyed by combat.ts terrain ids
interface TerrainVis {
  ground: [string, string, string];                 // base / dark / scorch
  fog: string; fogN: number; fogF: number;
  hemiSky: number; hemiGround: number; hemiInt: number;
  keyColor: number; keyInt: number;
  craters: number; trees: number; canopy: boolean; buildings: number;
  water: boolean; grass: boolean; rubble: boolean;
  hills: number; mist?: number; mistInt?: number;
}
const TERRAIN_VIS: Record<string, TerrainVis> = {
  mud:    { ground: ["#3a3a28", "#1d1f15", "#0f0e07"], fog: "#16202e", fogN: 14, fogF: 54, hemiSky: 0x46586e, hemiGround: 0x0a0d0a, hemiInt: 0.85, keyColor: 0xffb068, keyInt: 1.05, craters: 9, trees: 2, canopy: false, buildings: 0, water: true,  grass: false, rubble: false, hills: 0x0e131b },
  open:   { ground: ["#6f6c3c", "#48492a", "#2c2c18"], fog: "#2a323a", fogN: 20, fogF: 70, hemiSky: 0x71808c, hemiGround: 0x1c2012, hemiInt: 1.02, keyColor: 0xffd089, keyInt: 1.25, craters: 3, trees: 0, canopy: false, buildings: 0, water: false, grass: true,  rubble: false, hills: 0x182018, mist: 0xc9b870, mistInt: 0.18 },
  ridge:  { ground: ["#5c5140", "#352d20", "#16110a"], fog: "#1b212a", fogN: 14, fogF: 52, hemiSky: 0x52606e, hemiGround: 0x0c0d0a, hemiInt: 0.8,  keyColor: 0xffc078, keyInt: 1.08, craters: 6, trees: 1, canopy: false, buildings: 0, water: false, grass: false, rubble: false, hills: 0x1c222b },
  forest: { ground: ["#2a3525", "#16210f", "#0c1207"], fog: "#0e1a11", fogN: 11, fogF: 44, hemiSky: 0x3c5c46, hemiGround: 0x060a06, hemiInt: 0.82, keyColor: 0xd2e08a, keyInt: 0.92, craters: 3, trees: 16, canopy: true,  buildings: 0, water: false, grass: false, rubble: false, hills: 0x09140c, mist: 0x6f9b5a, mistInt: 0.22 },
  urban:  { ground: ["#4a463f", "#26241f", "#101010"], fog: "#1b1b20", fogN: 13, fogF: 50, hemiSky: 0x55565e, hemiGround: 0x0a0a0c, hemiInt: 0.82, keyColor: 0xffcaa0, keyInt: 1.0,  craters: 4, trees: 0, canopy: false, buildings: 9, water: false, grass: false, rubble: true,  hills: 0x141417 },
};

export default function BattleScene({
  player, enemy, accent, won, rungName, onDone, onResolve, winChance, terrainName, terrainId, tacticName, matchup,
}: { player: Force[]; enemy: Force[]; accent: string; won?: boolean; rungName: string;
     onDone?: () => void; onResolve?: (won: boolean, effort: number) => void;
     winChance?: number;
     terrainName?: string; terrainId?: string; tacticName?: string; matchup?: "advantage" | "even" | "disadvantage" }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const done = useRef(false);
  const [bars, setBars] = useState({ p: 1, e: 1 });
  const [used, setUsed] = useState<Set<string>>(new Set());
  const [resolved, setResolved] = useState(false);

  const interactive = onResolve != null && winChance != null;
  const effortRef = useRef(0);
  const outcomeRef = useRef<boolean | null>(null);   // true = player won (read by 3D for the fade)
  const resultRef = useRef<{ won: boolean; effort: number } | null>(null);
  const fxRef = useRef<{ type: string; t: number }[]>([]);

  const pTroops = player.reduce((s, u) => s + u.troops, 0);
  const eTroops = enemy.reduce((s, u) => s + u.troops, 0);

  const resolveNow = () => {
    if (resultRef.current) return resultRef.current;
    const chance = Math.max(4, Math.min(96, (winChance ?? 50) + effortRef.current));
    const w = Math.random() * 100 < chance;
    resultRef.current = { won: w, effort: effortRef.current };
    outcomeRef.current = w;
    setBars(w ? { p: 0.8, e: 0.1 } : { p: 0.22, e: 0.82 });
    setResolved(true);
    return resultRef.current;
  };
  const finish = () => {
    if (done.current) return; done.current = true;
    if (interactive) { const r = resolveNow(); onResolve!(r.won, r.effort); }
    else onDone?.();
  };

  const useAbility = (ab: Ability) => {
    if (!interactive || resolved || used.has(ab.id) || done.current) return;
    setUsed((s) => new Set(s).add(ab.id));
    effortRef.current += ab.effort;
    fxRef.current.push({ type: ab.fx, t: 0 });
    if (ab.id === "rally") setBars((b) => ({ p: Math.min(1, b.p + 0.05), e: b.e }));
    else setBars((b) => ({ p: b.p, e: Math.max(0.18, b.e - 0.08) }));
    playSfx("click");
  };

  useEffect(() => {
    if (interactive) {
      const t1 = setTimeout(() => setBars({ p: 0.72, e: 0.72 }), 1600);   // contested
      const tR = setTimeout(() => resolveNow(), 4000);                     // reveal outcome → rout begins
      const t2 = setTimeout(finish, 5800);
      return () => { clearTimeout(t1); clearTimeout(tR); clearTimeout(t2); };
    } else {
      outcomeRef.current = !!won;
      const t1 = setTimeout(() => setBars({ p: won ? 0.82 : 0.22, e: won ? 0.1 : 0.82 }), 1600);
      const t2 = setTimeout(finish, 4600);
      return () => { clearTimeout(t1); clearTimeout(t2); };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const mount = mountRef.current!;
    const vis = TERRAIN_VIS[terrainId ?? "mud"] ?? TERRAIN_VIS.mud;
    let W = mount.clientWidth || 800, H = mount.clientHeight || 500;
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.setSize(W, H); mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(new THREE.Color(vis.fog), vis.fogN, vis.fogF);
    const camera = new THREE.PerspectiveCamera(44, W / H, 0.1, 120);
    camera.position.set(0, 6.8, 15.2); camera.lookAt(0, 1.1, -1);

    // ---- LIGHTING (dusk warzone, tinted by terrain) ----
    scene.add(new THREE.HemisphereLight(vis.hemiSky, vis.hemiGround, vis.hemiInt));
    const key = new THREE.DirectionalLight(vis.keyColor, vis.keyInt); key.position.set(-12, 8, 6); scene.add(key);  // low sun rake
    const fill = new THREE.DirectionalLight(0x5c7fae, 0.45); fill.position.set(9, 6, 11); scene.add(fill); // cool fill
    const fireLight = new THREE.PointLight(0xff6a22, 2.0, 28, 2); fireLight.position.set(11.5, 2.6, -7); scene.add(fireLight); // burning wreck

    // small helper: faceted box mesh
    const box = (w: number, h: number, d: number, color: THREE.ColorRepresentation) =>
      new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshStandardMaterial({ color, flatShading: true, roughness: 1 }));

    // ---- GROUND (cratered, terrain-tinted) ----
    const TW = 66, TD = 42;
    const gGeo = new THREE.PlaneGeometry(TW, TD, 66, 42); gGeo.rotateX(-Math.PI / 2);
    const gp = gGeo.attributes.position as THREE.BufferAttribute;
    const craters = Array.from({ length: vis.craters }, () => ({
      x: (Math.random() - 0.5) * TW * 0.8, z: (Math.random() - 0.5) * TD * 0.7,
      r: 1.8 + Math.random() * 2.8, d: 0.5 + Math.random() * 1.0,
    }));
    const gc = new Float32Array(gp.count * 3);
    const mud = new THREE.Color(vis.ground[0]), dk = new THREE.Color(vis.ground[1]), scorch = new THREE.Color(vis.ground[2]), c = new THREE.Color();
    for (let i = 0; i < gp.count; i++) {
      const x = gp.getX(i), z = gp.getZ(i);
      let y = Math.sin(x * 0.4) * 0.16 + Math.cos(z * 0.5) * 0.14 + (Math.random() - 0.5) * 0.18;
      let burn = 0;
      for (const cr of craters) {
        const d = Math.hypot(x - cr.x, z - cr.z);
        if (d < cr.r) { const t = d / cr.r; y -= Math.cos(t * Math.PI / 2) * cr.d; burn = Math.max(burn, 1 - t); }          // bowl
        else if (d < cr.r * 1.4) { const t = (d - cr.r) / (cr.r * 0.4); y += (1 - t) * cr.d * 0.3; burn = Math.max(burn, (1 - t) * 0.5); } // rim
      }
      gp.setY(i, y);
      c.copy(mud).lerp(dk, Math.random() * 0.6).lerp(scorch, burn * 0.85);  // scorch darkens near craters
      gc[i * 3] = c.r; gc[i * 3 + 1] = c.g; gc[i * 3 + 2] = c.b;
    }
    gGeo.setAttribute("color", new THREE.BufferAttribute(gc, 3)); gGeo.computeVertexNormals();
    scene.add(new THREE.Mesh(gGeo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1 })));

    // ---- WATER-FILLED SHELL HOLES (mud) ----
    if (vis.water) {
      const waterMat = new THREE.MeshStandardMaterial({ color: "#1b2630", roughness: 0.25, metalness: 0.5, transparent: true, opacity: 0.85, flatShading: true });
      craters.slice(0, 5).forEach((cr) => {
        const disc = new THREE.Mesh(new THREE.CircleGeometry(cr.r * 0.62, 18), waterMat);
        disc.rotation.x = -Math.PI / 2; disc.position.set(cr.x, -cr.d * 0.55 + 0.05, cr.z); scene.add(disc);
      });
    }

    // ---- GRASS TUFTS (open ground) ----
    if (vis.grass) {
      const grassMat = new THREE.MeshStandardMaterial({ color: "#7c7a3e", flatShading: true, roughness: 1 });
      for (let i = 0; i < 60; i++) {
        const bl = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5 + Math.random() * 0.4, 4), grassMat);
        bl.position.set((Math.random() - 0.5) * TW * 0.85, 0.25, (Math.random() - 0.5) * TD * 0.7);
        bl.rotation.y = Math.random() * Math.PI; scene.add(bl);
      }
    }

    // ---- SANDBAG EMPLACEMENTS (flanking, behind the lines) ----
    const sandbags = (cx: number, cz: number, len: number, angle: number) => {
      const g = new THREE.Group();
      for (let r = 0; r < 2; r++) for (let i = 0; i < len; i++) {
        const b = box(0.72, 0.42, 0.5, new THREE.Color("#6e6446").offsetHSL(0, 0, (Math.random() - 0.5) * 0.08).getHex());
        b.position.set((i - (len - 1) / 2) * 0.62 + (r % 2) * 0.3, 0.22 + r * 0.38, 0);
        b.rotation.y = (Math.random() - 0.5) * 0.25; g.add(b);
      }
      g.position.set(cx, 0, cz); g.rotation.y = angle; scene.add(g);
    };
    sandbags(-13, 5, 7, 0.18); sandbags(13, 5, 7, -0.18); sandbags(-10, -8, 5, 0.6); sandbags(10, -9, 5, -0.5);

    // ---- WRECKED TANK (knocked out, burning) ----
    const wreck = new THREE.Group();
    const hull = box(3.2, 1.1, 1.8, "#2c3026"); hull.position.y = 0.72; wreck.add(hull);
    const turret = box(1.4, 0.8, 1.2, "#262a20"); turret.position.set(0.2, 1.5, 0); turret.rotation.y = 0.4; wreck.add(turret);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.09, 1.6, 6), new THREE.MeshStandardMaterial({ color: "#1c1f17", flatShading: true }));
    barrel.rotation.z = Math.PI / 2; barrel.position.set(1.45, 1.5, 0); wreck.add(barrel);
    const trackL = box(3.4, 0.5, 0.5, "#1a1d16"); trackL.position.set(0, 0.3, 0.9); wreck.add(trackL);
    const trackR = box(3.4, 0.5, 0.5, "#1a1d16"); trackR.position.set(0, 0.3, -0.9); wreck.add(trackR);
    wreck.position.set(11.5, 0, -7); wreck.rotation.set(0.12, 0.7, 0.16); scene.add(wreck);

    // ---- TREES / STUMPS (forest = standing timber, else shattered stumps) ----
    const stump = (x: number, z: number, h: number) => {
      const m = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.34, h, 5, 1), new THREE.MeshStandardMaterial({ color: "#241b12", flatShading: true, roughness: 1 }));
      m.position.set(x, h / 2, z); m.rotation.y = Math.random() * Math.PI; scene.add(m);
    };
    const tree = (x: number, z: number) => {
      const h = 2.6 + Math.random() * 2.2;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, h, 5), new THREE.MeshStandardMaterial({ color: "#2c2114", flatShading: true, roughness: 1 }));
      trunk.position.set(x, h / 2, z); scene.add(trunk);
      const can = new THREE.Mesh(new THREE.ConeGeometry(1.1 + Math.random() * 0.6, 2.4 + Math.random() * 1.2, 6),
        new THREE.MeshStandardMaterial({ color: new THREE.Color("#1f3a22").offsetHSL(0, 0, (Math.random() - 0.5) * 0.08).getHex(), flatShading: true, roughness: 1 }));
      can.position.set(x, h + 0.7, z); scene.add(can);
    };
    if (vis.canopy) {
      // forest: ring of trees around the flanks/back, leaving the centre clear for the clash
      for (let i = 0; i < vis.trees; i++) {
        const side = i % 2 ? 1 : -1;
        const x = side * (12 + Math.random() * 10);
        const z = -12 + Math.random() * 18;
        Math.random() < 0.8 ? tree(x, z) : stump(x, z, 1.2 + Math.random());
      }
      tree(-9, -9); tree(9, -10); tree(-15, 2); tree(16, 1);
    } else {
      const spots: [number, number, number][] = [[-16, -6, 1.7], [-13, -11, 1.1], [15, -11, 1.5], [-18, 3, 2.1], [17, -3, 1.2], [-7, -10, 0.9]];
      spots.slice(0, vis.trees).forEach(([x, z, h]) => stump(x, z, h));
    }

    // ---- RUINED BUILDINGS + RUBBLE (urban) ----
    if (vis.buildings > 0) {
      const wallMat = (l: number) => new THREE.MeshStandardMaterial({ color: new THREE.Color("#564f47").offsetHSL(0, 0, l).getHex(), flatShading: true, roughness: 1 });
      const ruin = (cx: number, cz: number, w: number, hgt: number, d: number) => {
        const g = new THREE.Group();
        const back = box(w, hgt, 0.4, "#4c463e"); back.position.set(0, hgt / 2, -d / 2); g.add(back);
        const sideW = box(0.4, hgt * 0.8, d, "#433d36"); sideW.position.set(-w / 2, hgt * 0.4, 0); g.add(sideW);
        // broken top edge — random missing crenellations
        for (let i = 0; i < Math.round(w); i++) if (Math.random() < 0.6) {
          const brick = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5 + Math.random() * 0.8, 0.4), wallMat((Math.random() - 0.5) * 0.1));
          brick.position.set(-w / 2 + 0.5 + i, hgt + 0.2, -d / 2); g.add(brick);
        }
        g.position.set(cx, 0, cz); g.rotation.y = (Math.random() - 0.5) * 0.5; scene.add(g);
      };
      for (let i = 0; i < vis.buildings; i++) {
        const side = i % 2 ? 1 : -1;
        ruin(side * (11 + Math.random() * 9), -10 + Math.random() * 16, 2.5 + Math.random() * 2.5, 2.2 + Math.random() * 2.6, 2 + Math.random() * 2);
      }
    }
    if (vis.rubble) {
      const rb = new THREE.MeshStandardMaterial({ color: "#3a352f", flatShading: true, roughness: 1 });
      for (let i = 0; i < 40; i++) {
        const r = new THREE.Mesh(new THREE.BoxGeometry(0.3 + Math.random() * 0.6, 0.2 + Math.random() * 0.4, 0.3 + Math.random() * 0.6), rb);
        r.position.set((Math.random() - 0.5) * TW * 0.7, 0.15, (Math.random() - 0.5) * TD * 0.6);
        r.rotation.set(Math.random(), Math.random(), Math.random()); scene.add(r);
      }
    }

    // ---- BARBED-WIRE BELT (back scenery) ----
    const postMat = new THREE.MeshStandardMaterial({ color: "#1d1813", flatShading: true });
    const wireBelt = (z: number) => {
      const n = 26, pts: THREE.Vector3[] = [];
      for (let i = 0; i <= n; i++) pts.push(new THREE.Vector3(-23 + 46 * i / n, 0.4 + Math.sin(i * 1.7) * 0.28, z));
      scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x6b6f63, transparent: true, opacity: 0.5 })));
      for (let i = 0; i <= n; i += 3) { const p = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.9, 4), postMat); p.position.set(-23 + 46 * i / n, 0.45, z); p.rotation.z = (Math.random() - 0.5) * 0.25; scene.add(p); }
    };
    wireBelt(-10);

    // ---- DISTANT RIDGE SILHOUETTE ----
    for (let i = 0; i < 7; i++) {
      const hill = new THREE.Mesh(new THREE.ConeGeometry(6 + Math.random() * 4, 3 + Math.random() * 2.5, 4), new THREE.MeshStandardMaterial({ color: vis.hills, flatShading: true }));
      hill.position.set(-22 + i * 7.5, 0, -20); hill.rotation.y = Math.PI / 4; scene.add(hill);
    }

    // ---- TERRAIN MIST BAND (forest gloom / open dust haze) ----
    if (vis.mist != null) {
      const mistMat = new THREE.MeshBasicMaterial({ color: vis.mist, transparent: true, opacity: vis.mistInt ?? 0.18, depthWrite: false, fog: false });
      for (let i = 0; i < 4; i++) {
        const band = new THREE.Mesh(new THREE.PlaneGeometry(70, 8), mistMat);
        band.position.set(0, 1.2 + i * 0.6, -14 + i * 2); scene.add(band);
      }
    }
    // ---- FIRE GLOW + SMOKE TEXTURES ----
    const radialTex = (stops: [number, string][]) => {
      const cv = document.createElement("canvas"); cv.width = cv.height = 64; const cx = cv.getContext("2d")!;
      const g = cx.createRadialGradient(32, 32, 1, 32, 32, 31); stops.forEach(([o, col]) => g.addColorStop(o, col));
      cx.fillStyle = g; cx.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv);
    };
    const fireTex = radialTex([[0, "rgba(255,190,90,1)"], [0.4, "rgba(255,110,30,0.85)"], [1, "rgba(255,80,20,0)"]]);
    const smokeTex = radialTex([[0, "rgba(46,46,50,0.92)"], [1, "rgba(46,46,50,0)"]]);
    const fireGlow = new THREE.Sprite(new THREE.SpriteMaterial({ map: fireTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    fireGlow.scale.set(3.4, 3.4, 1); fireGlow.position.set(11.5, 1.9, -7); scene.add(fireGlow);

    // drifting smoke columns
    type Smoke = { s: THREE.Sprite; vy: number; life: number; max: number; baseX: number };
    const smokes: Smoke[] = [];
    const smokeSrc = [{ x: 11.5, z: -7 }, { x: -9, z: -6 }, { x: 3, z: -9 }, { x: -3, z: -8 }];

    // ---- subtle per-side ground glow (whose line is whose) ----
    const glow = (hex: number, x: number) => {
      const m = new THREE.Mesh(new THREE.CircleGeometry(5.5, 28),
        new THREE.MeshBasicMaterial({ color: hex, transparent: true, opacity: 0.11, blending: THREE.AdditiveBlending, depthWrite: false, fog: false }));
      m.rotation.x = -Math.PI / 2; m.position.set(x, 0.05, 0); scene.add(m);
    };
    glow(new THREE.Color(accent).getHex(), -5); glow(0xe5414f, 5);

    const shadowTex = makeShadowTexture();
    type Spr = { s: THREE.Sprite; sh: THREE.Sprite; x0: number; x1: number; dir: number; rank: number; side: "P" | "E"; h: number; baseZ: number; routZ: number; routSpeed: number; falls: boolean };
    const sprites: Spr[] = [];

    const build = (forces: Force[], side: "P" | "E") => {
      const dir = side === "P" ? -1 : 1;
      const ranks: { defId: string; kind: string }[][] = [[], [], []];
      forces.forEach((u) => {
        const def = CATALOG[u.defId]; if (!def) return;
        const r = RANK[def.kind] ?? 1;
        const n = Math.min(4, Math.max(1, Math.round(u.troops / 2000)));
        for (let k = 0; k < n; k++) ranks[r].push({ defId: u.defId, kind: def.kind });
      });
      ranks.forEach((arr, r) => {
        const cols = arr.length;
        arr.forEach((f, ci) => {
          const def = CATALOG[f.defId];
          const big = RANK[f.kind] === 2;
          const h = (big ? 2.9 : 2.6) + Math.random() * 0.3, w = h * 0.66;
          const tex = getUnitTexture(f.defId, def.kind, side);
          const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false });
          if (side === "E") mat.color.set(0xff5a4c);                 // red tint marks the enemy faction
          const s = new THREE.Sprite(mat);
          s.scale.set(w, h, 1);                                      // positive scale both sides; enemy texture is UV-mirrored
          const z = (ci - (cols - 1) / 2) * 1.3 + (r % 2) * 0.5;     // ranks stagger slightly
          const x1 = dir * (2.2 + r * 1.9);
          const x0 = x1 + dir * 6.5;
          s.position.set(x0, h / 2, z); scene.add(s);
          const sh = new THREE.Sprite(new THREE.SpriteMaterial({ map: shadowTex, transparent: true, depthWrite: false, opacity: 0.45 }));
          sh.scale.set(w * 0.95, w * 0.5, 1); sh.position.set(x0, 0.06, z); scene.add(sh);
          sprites.push({ s, sh, x0, x1, dir, rank: r, side, h, baseZ: z, routZ: (Math.random() - 0.5) * 4.5, routSpeed: 6 + Math.random() * 4.5, falls: Math.random() < 0.18 });
        });
      });
    };
    build(player, "P"); build(enemy, "E");

    // muzzle flashes
    const flashTex = (() => {
      const cv = document.createElement("canvas"); cv.width = cv.height = 64; const cx = cv.getContext("2d")!;
      const g = cx.createRadialGradient(32, 32, 1, 32, 32, 30); g.addColorStop(0, "rgba(255,222,150,1)"); g.addColorStop(1, "rgba(255,150,40,0)");
      cx.fillStyle = g; cx.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv);
    })();
    const flashes: THREE.Sprite[] = [];
    const ease = (x: number) => 1 - Math.pow(1 - x, 3);

    // ability effect spawners (consumed from fxRef in the tick)
    let fxShake = 0;
    const burst = (color: number, xa: number, xb: number, n: number, y0: number) => {
      for (let k = 0; k < n; k++) {
        const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, color: new THREE.Color(color), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        const sc = 1 + Math.random() * 1.8; fl.scale.set(sc, sc, 1);
        fl.position.set(xa + Math.random() * (xb - xa), y0 + Math.random() * 1.8, (Math.random() - 0.5) * 8);
        scene.add(fl); flashes.push(fl);
      }
    };
    const gasFx = () => {
      for (let k = 0; k < 7; k++) {
        const sm = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, color: new THREE.Color(0x9bd14a), transparent: true, depthWrite: false, opacity: 0 }));
        const sc = 2.2 + Math.random() * 2; sm.scale.set(sc, sc, 1);
        sm.position.set(3 + Math.random() * 5, 0.8, (Math.random() - 0.5) * 8);
        scene.add(sm); smokes.push({ s: sm, vy: 0.008 + Math.random() * 0.012, life: 0, max: 3 + Math.random() * 2, baseX: sm.position.x });
      }
    };
    const triggerFx = (type: string) => {
      if (type === "barrage") burst(0xffc060, 2, 9.5, 16, 0.5);
      else if (type === "flank") burst(0xff7a4c, 2, 9.5, 9, 0.5);
      else if (type === "gas") gasFx();
      else if (type === "rally") burst(new THREE.Color(accent).getHex(), -9.5, -2, 9, 0.6);
      fxShake = 0.35;
    };

    let raf = 0; const clock = new THREE.Clock();
    const tick = () => {
      const t = clock.getElapsedTime();
      const adv = ease(Math.min(1, t / 1.6));
      const loser: "P" | "E" | null = outcomeRef.current == null ? null : (outcomeRef.current ? "E" : "P");
      for (const sp of sprites) {
        let x = THREE.MathUtils.lerp(sp.x0, sp.x1, adv);
        if (t > 1.6 && sp.rank === 0) { const k = Math.min(1, (t - 1.6) / 0.6); x += -sp.dir * 0.9 * k; } // front ranks lurch into contact
        let y = sp.h / 2 + Math.abs(Math.sin(t * 6 + sp.x0)) * 0.05;
        let op = 1, z = sp.baseZ;
        const rk = loser ? t - 4.0 : -1;                            // seconds since the rout began
        if (loser && rk > 0) {
          if (sp.side === loser) {
            if (sp.falls) {                                          // ~18% are cut down where they stand
              const k = Math.min(1, rk / 0.8); op = 1 - k; y = sp.h / 2 - k * 0.9;
            } else {                                                // the rest break and flee toward their home edge
              x += sp.dir * sp.routSpeed * rk;
              z = sp.baseZ + sp.routZ * Math.min(1, rk);            // scatter sideways
              y = sp.h / 2 + Math.abs(Math.sin(t * 13 + sp.x0)) * 0.14; // panicked running bob
              op = 1 - Math.min(1, rk / 1.4);
            }
          } else {                                                  // victors surge forward into the vacated ground
            x += -sp.dir * Math.min(1.6, rk * 0.95);
            y = sp.h / 2 + Math.abs(Math.sin(t * 7 + sp.x0)) * 0.09;
          }
        }
        sp.s.position.set(x, y, z); sp.sh.position.set(x, 0.06, z);
        (sp.s.material as THREE.SpriteMaterial).opacity = op;
        (sp.sh.material as THREE.SpriteMaterial).opacity = 0.45 * op;
      }
      // consume queued ability effects
      for (let i = fxRef.current.length - 1; i >= 0; i--) { triggerFx(fxRef.current[i].type); fxRef.current.splice(i, 1); }
      if (t > 1.5 && t < 4 && Math.random() < 0.5) {
        const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: flashTex, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending }));
        const sc = 0.5 + Math.random() * 1.1; fl.scale.set(sc, sc, 1);
        fl.position.set((Math.random() - 0.5) * 4.5, 0.7 + Math.random() * 1.5, (Math.random() - 0.5) * 8);
        scene.add(fl); flashes.push(fl);
      }
      for (let i = flashes.length - 1; i >= 0; i--) {
        const m = flashes[i].material as THREE.SpriteMaterial; m.opacity -= 0.07;
        if (m.opacity <= 0) { scene.remove(flashes[i]); flashes.splice(i, 1); }
      }
      // --- ambient warzone: fire flicker + drifting smoke ---
      fireLight.intensity = 1.8 + Math.sin(t * 17) * 0.4 + Math.random() * 0.35;
      (fireGlow.material as THREE.SpriteMaterial).opacity = 0.6 + Math.sin(t * 15) * 0.18;
      fireGlow.scale.setScalar(3.3 + Math.sin(t * 12) * 0.3);
      if (Math.random() < 0.28 && smokes.length < 44) {
        const src = smokeSrc[(Math.random() * smokeSrc.length) | 0];
        const sm = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0 }));
        const sc = 1.2 + Math.random() * 1.4; sm.scale.set(sc, sc, 1);
        sm.position.set(src.x + (Math.random() - 0.5), 0.6, src.z + (Math.random() - 0.5));
        scene.add(sm); smokes.push({ s: sm, vy: 0.012 + Math.random() * 0.022, life: 0, max: 2.6 + Math.random() * 2.2, baseX: sm.position.x });
      }
      for (let i = smokes.length - 1; i >= 0; i--) {
        const sm = smokes[i]; sm.life += 0.016; sm.s.position.y += sm.vy;
        sm.s.position.x = sm.baseX + Math.sin(sm.life * 1.4) * 0.4;
        const lf = sm.life / sm.max;
        (sm.s.material as THREE.SpriteMaterial).opacity = Math.sin(Math.min(1, lf) * Math.PI) * 0.5;
        sm.s.scale.setScalar(1.2 + lf * 2.6);
        if (sm.life >= sm.max) { scene.remove(sm.s); smokes.splice(i, 1); }
      }
      const baseShake = t > 1.6 && t < 2.1 ? (Math.random() - 0.5) * 0.25 : 0;
      if (fxShake > 0) fxShake = Math.max(0, fxShake - 0.02);
      const shake = baseShake + (Math.random() - 0.5) * fxShake;
      camera.position.x = Math.sin(t * 0.35) * 0.5 + shake;
      camera.lookAt(0, 1.2, -0.5);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    const onResize = () => { W = mount.clientWidth; H = mount.clientHeight; camera.aspect = W / H; camera.updateProjectionMatrix(); renderer.setSize(W, H); };
    window.addEventListener("resize", onResize);
    return () => {
      cancelAnimationFrame(raf); window.removeEventListener("resize", onResize);
      scene.traverse((o) => { const m = o as any; if (m.geometry) m.geometry.dispose(); if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x: any) => x.dispose && x.dispose()); });
      renderer.dispose(); if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="ba">
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: CSS }} />
      <div ref={mountRef} className="ba-scene" />
      <div className="ba-grain" />
      <div className="ba-hud">
        <div className="ba-bars">
          <div className="ba-side">
            <div className="ba-sLab"><span style={{ color: accent }}>YOUR FORCE</span><b>{fmt(Math.round(pTroops * bars.p))}</b></div>
            <div className="ba-bar"><i style={{ width: `${bars.p * 100}%`, background: accent }} /></div>
          </div>
          <div className="ba-vs">⚔</div>
          <div className="ba-side r">
            <div className="ba-sLab"><b>{fmt(Math.round(eTroops * bars.e))}</b><span style={{ color: "#e5414f" }}>{rungName.toUpperCase()}</span></div>
            <div className="ba-bar"><i className="r" style={{ width: `${bars.e * 100}%` }} /></div>
          </div>
        </div>
        {(terrainName || tacticName || matchup) && (
          <div className="ba-tac">
            {terrainName && <span className="ba-chip">⛰ {terrainName}</span>}
            {tacticName && <span className="ba-chip">⚑ {tacticName}</span>}
            {matchup && <span className={"ba-chip ba-" + matchup}>
              {matchup === "advantage" ? "▲ Favourable matchup" : matchup === "disadvantage" ? "▼ Hard matchup" : "● Even matchup"}
            </span>}
          </div>
        )}
      </div>

      {interactive && !resolved && (
        <div className="ba-abilities">
          <div className="ba-abLab">TACTICAL ORDERS · tap to use (once each)</div>
          <div className="ba-abRow">
            {ABILITIES.map((ab) => (
              <button key={ab.id} className={"ba-ability" + (used.has(ab.id) ? " spent" : "")} disabled={used.has(ab.id)} onClick={() => useAbility(ab)}>
                <span className="ba-abIcon">{ab.icon}</span>
                <span className="ba-abName">{ab.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      <button className="ba-skip" onClick={finish}>Skip ▸▸</button>
    </div>
  );
}

const CSS = `
.ba { position: fixed; inset: 0; z-index: 50; overflow: hidden;
  background: radial-gradient(120% 90% at 50% 10%, #1a2436 0%, #0a0e16 60%, #07090f 100%); }
.ba-scene { position: absolute; inset: 0; }
.ba-grain { position: absolute; inset: 0; pointer-events: none; opacity: .22; mix-blend-mode: overlay;
  background-image: radial-gradient(rgba(0,0,0,.3) 1px, transparent 1px); background-size: 3px 3px; }
.ba-hud { position: absolute; top: 0; left: 0; right: 0; padding: 18px 22px; z-index: 2;
  background: linear-gradient(180deg, rgba(7,9,15,.85), transparent); font-family: 'Oswald', sans-serif; color: #e9eef7; }
.ba-bars { display: flex; align-items: center; gap: 16px; max-width: 820px; margin: 0 auto; }
.ba-tac { display: flex; gap: 8px; justify-content: center; margin: 10px auto 0; max-width: 820px; flex-wrap: wrap; }
.ba-chip { font-family: 'Space Grotesk', monospace; font-size: 11px; letter-spacing: 1px; color: #cfdaec;
  background: rgba(14,24,38,.7); border: 1px solid rgba(120,150,190,.22); padding: 5px 11px; border-radius: 99px; }
.ba-chip.ba-advantage { color: #4fd190; border-color: rgba(79,209,144,.5); }
.ba-chip.ba-disadvantage { color: #e5414f; border-color: rgba(229,65,79,.5); }
.ba-abilities { position: absolute; bottom: 26px; left: 0; right: 0; z-index: 3; text-align: center; }
.ba-abLab { font-family: 'Space Grotesk', monospace; font-size: 10px; letter-spacing: 2px; color: #93a2bd; margin-bottom: 8px; }
.ba-abRow { display: flex; gap: 10px; justify-content: center; flex-wrap: wrap; padding: 0 14px; }
.ba-ability { display: flex; flex-direction: column; align-items: center; gap: 3px; cursor: pointer; min-width: 78px;
  background: rgba(16,24,38,.82); border: 1px solid rgba(120,150,190,.3); padding: 10px 12px; color: #eef2fa;
  -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); transition: transform .12s, border-color .12s, background .12s;
  clip-path: polygon(0 6px,6px 0,calc(100% - 6px) 0,100% 6px,100% calc(100% - 6px),calc(100% - 6px) 100%,6px 100%,0 calc(100% - 6px)); }
.ba-ability:hover { transform: translateY(-2px); border-color: #56b9cf; background: rgba(26,40,60,.9); }
.ba-ability.spent { opacity: .32; cursor: not-allowed; transform: none; }
.ba-abIcon { font-size: 20px; line-height: 1; }
.ba-abName { font-family: 'Oswald'; font-size: 12px; letter-spacing: 1px; }
@media (max-width: 560px) { .ba-ability { min-width: 64px; padding: 8px 9px; } .ba-abIcon { font-size: 17px; } }
.ba-side { flex: 1; }
.ba-sLab { display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 5px; }
.ba-side.r .ba-sLab { flex-direction: row-reverse; }
.ba-sLab span { font-family: 'Space Grotesk', monospace; font-size: 11px; letter-spacing: 2px; }
.ba-sLab b { font-family: 'Space Grotesk', monospace; font-size: 18px; }
.ba-bar { height: 12px; background: rgba(150,180,225,.12); overflow: hidden;
  clip-path: polygon(0 3px,3px 0,calc(100% - 3px) 0,100% 3px,100% calc(100% - 3px),calc(100% - 3px) 100%,3px 100%,0 calc(100% - 3px)); }
.ba-bar i { display: block; height: 100%; transition: width 2.4s cubic-bezier(.4,0,.2,1); }
.ba-bar i.r { margin-left: auto; background: #e5414f; }
.ba-vs { font-size: 22px; color: #f0c860; }
.ba-skip { position: absolute; top: 18px; right: 22px; z-index: 3; cursor: pointer; font-family: 'Space Grotesk', monospace;
  font-size: 12px; letter-spacing: 2px; color: #aebbd2; background: rgba(20,30,46,.7); border: none; padding: 9px 16px;
  clip-path: polygon(0 5px,5px 0,calc(100% - 5px) 0,100% 5px,100% calc(100% - 5px),calc(100% - 5px) 100%,5px 100%,0 calc(100% - 5px)); }
.ba-skip:hover { color: #fff; }
@media (max-width: 560px) { .ba-sLab span { font-size: 9px; } }
`;
