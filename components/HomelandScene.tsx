"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { type Plot } from "@/lib/economy";

/**
 * HomelandScene — nation-themed town with higher-fidelity rendering.
 * components/HomelandScene.tsx
 *
 * Fidelity: ACES filmic tone mapping, PMREM environment reflections, an
 * UnrealBloom glow pass, procedural grass + water textures, smooth shading,
 * rounded (chamfered) building bodies, and high-res soft shadows.
 * 20 plots in a 5×4 street grid on a big island, unique per-nation biome,
 * service trucks on the roads. Camera PANS (drag) + zooms (wheel / pinch).
 */

type Biome = "veld" | "european" | "steppe" | "plains" | "isles";
const NATION_BIOME: Record<string, Biome> = {
  southafrica: "veld",
  britain: "european", france: "european", germany: "european", belgium: "european",
  italy: "european", austria: "european", serbia: "european", romania: "european", bulgaria: "european",
  russia: "steppe", ottoman: "steppe", usa: "plains", japan: "isles",
};
interface Theme { grass: number; grassDk: number; sand: number; dirt: number; cliff: number; rock: number; water: number; tree: "acacia" | "oak" | "pine"; fence: "palisade" | "stone" | "hedge" | "none"; }
const THEMES: Record<Biome, Theme> = {
  veld:     { grass: 0x9a8b4e, grassDk: 0x7e6f38, sand: 0xc9a96e, dirt: 0x7a5a32, cliff: 0x6e5a3c, rock: 0x8a6b48, water: 0x2f6f8f, tree: "acacia", fence: "palisade" },
  european: { grass: 0x5c8a4a, grassDk: 0x47753c, sand: 0xc9b27e, dirt: 0x6b5236, cliff: 0x4f4a42, rock: 0x3c3a36, water: 0x2f6f8f, tree: "oak", fence: "stone" },
  steppe:   { grass: 0x808a54, grassDk: 0x67703f, sand: 0xbfae7c, dirt: 0x5e4a30, cliff: 0x4a463c, rock: 0x55524a, water: 0x356f86, tree: "pine", fence: "none" },
  plains:   { grass: 0x6f9a4e, grassDk: 0x537a3a, sand: 0xc9b27e, dirt: 0x6b5236, cliff: 0x4f4a42, rock: 0x4a463c, water: 0x2f7f9a, tree: "oak", fence: "hedge" },
  isles:    { grass: 0x4f8a52, grassDk: 0x3c7340, sand: 0xd2c089, dirt: 0x5a4630, cliff: 0x46524a, rock: 0x3c3a36, water: 0x2f8f9a, tree: "pine", fence: "hedge" },
};

export default function HomelandScene({
  plots, selected, accent, nation, onSelect, onReady,
}: { plots: Plot[]; selected: number | null; accent: string; nation: string | null; onSelect: (index: number | null) => void; onReady?: () => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const api = useRef<{ rebuild: (p: Plot[], sel: number | null, acc: string) => void } | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  const COLS = 5, ROWS = 4, GX = 5, GZ = 5;
  const POS: [number, number][] = [];
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) POS.push([(c - (COLS - 1) / 2) * GX, (r - (ROWS - 1) / 2) * GZ]);

  useEffect(() => {
    const mount = ref.current!;
    let W = mount.clientWidth || 360, H = mount.clientHeight || 480;
    const mobile = Math.min(W, H) < 560;
    const theme = THEMES[NATION_BIOME[nation || ""] || "european"];

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    const pr = Math.min(window.devicePixelRatio, mobile ? 1.5 : 2);
    renderer.setPixelRatio(pr); renderer.setSize(W, H);
    renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;          // filmic contrast/colour
    renderer.toneMappingExposure = 1.14;          // golden-hour lift
    const maxAniso = renderer.capabilities.getMaxAnisotropy();
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.Fog(new THREE.Color("#0b1320"), 64, 138);

    // ---- gradient sky dome + additive sun (depth + something for bloom to catch) ----
    const sky = new THREE.Mesh(
      new THREE.SphereGeometry(200, 32, 16),
      new THREE.ShaderMaterial({
        side: THREE.BackSide, depthWrite: false, fog: false,
        uniforms: { top: { value: new THREE.Color("#1b3a5a") }, bot: { value: new THREE.Color("#0a0f18") }, off: { value: 0.18 } },
        vertexShader: "varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }",
        fragmentShader: "varying vec3 vP; uniform vec3 top; uniform vec3 bot; uniform float off; void main(){ float h = clamp(normalize(vP).y*0.5+0.5+off,0.0,1.0); gl_FragColor = vec4(mix(bot, top, h), 1.0); }",
      })
    );
    scene.add(sky);
    const sunTex = (() => { const cv = document.createElement("canvas"); cv.width = cv.height = 128; const c = cv.getContext("2d")!; const g = c.createRadialGradient(64, 64, 2, 64, 64, 64); g.addColorStop(0, "rgba(255,244,214,1)"); g.addColorStop(0.4, "rgba(255,210,140,0.55)"); g.addColorStop(1, "rgba(255,200,120,0)"); c.fillStyle = g; c.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(cv); })();
    const sun = new THREE.Sprite(new THREE.SpriteMaterial({ map: sunTex, transparent: true, depthWrite: false, fog: false, blending: THREE.AdditiveBlending }));
    sun.scale.setScalar(34); sun.position.set(-60, 70, -90); scene.add(sun);  // roughly behind the key light

    // ---- environment reflections (PMREM) ----
    const pmrem = new THREE.PMREMGenerator(renderer);
    const envRT = pmrem.fromScene(new RoomEnvironment(), 0.04);
    scene.environment = envRT.texture;

    const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 280);
    const target = new THREE.Vector3(0, 0, 0);   // look-at GOAL (pan moves this)
    let zoom = 1;                                  // zoom GOAL (wheel/pinch moves this)
    const baseOff = new THREE.Vector3(0, 34, 7);   // steep overhead (~78° pitch)
    const PAN = 13;

    // --- smoothed camera state: the real camera lerps toward the goal each frame ---
    const camPos = new THREE.Vector3();            // current camera position
    const curLook = new THREE.Vector3(0, 0.6, 0);  // current look-at point
    const _v = new THREE.Vector3();                // scratch vector (reused per frame)
    let curZoom = 1, orbit = 0;                    // smoothed zoom + idle-orbit angle
    let lastInput = performance.now();             // last pan/zoom/tap time (for idle drift)

    const easeOutBack = (k: number) => { const c1 = 1.70158, c3 = c1 + 1; return 1 + c3 * Math.pow(k - 1, 3) + c1 * Math.pow(k - 1, 2); }; // overshoot easing
    const aspectF = () => { const a = W / H; return a < 0.65 ? 1.55 : a < 1 ? 1.2 : 1; };  // pull camera back on tall phones

    // desired camera position for the current target + zoom (+ gentle idle orbit)
    const goalPos = (out: THREE.Vector3) => {
      const o = baseOff.clone().multiplyScalar(curZoom * aspectF());
      const s = Math.sin(orbit), c = Math.cos(orbit);                // rotate offset around Y
      return out.set(target.x + o.x * c - o.z * s, o.y, target.z + o.x * s + o.z * c);
    };

    // hard snap — used on init + resize so the first frame has no lurch
    const place = () => {
      camera.aspect = W / H; camera.updateProjectionMatrix();
      curZoom = zoom; goalPos(camPos); camera.position.copy(camPos);
      curLook.set(target.x, 0.6, target.z); camera.lookAt(curLook);
    };
    place();

    // fly the camera so the tapped plot sits ABOVE the bottom sheet
    const FOCUS_LIFT = 3.2;                         // bigger = plot sits higher on screen
    const focusPlot = (i: number | null) => {
      if (i == null) return;                        // keep current framing on deselect
      const [px, pz] = POS[i];
      target.set(Math.max(-PAN, Math.min(PAN, px)), 0, Math.max(-PAN, Math.min(PAN, pz + FOCUS_LIFT)));
      zoom = Math.min(zoom, 0.82);                  // ease in a touch
      lastInput = performance.now();
    };

    // ---- post-processing (bloom) ----
    // MSAA + HDR render target — keeps faceted edges crisp through the composer
    const rtSize = renderer.getDrawingBufferSize(new THREE.Vector2());
    const composerRT = new THREE.WebGLRenderTarget(rtSize.width, rtSize.height, { type: THREE.HalfFloatType, samples: mobile ? 2 : 4 });
    const composer = new EffectComposer(renderer, composerRT);
    composer.setPixelRatio(pr); composer.setSize(W, H);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(W, H), mobile ? 0.32 : 0.5, 0.5, 0.85); // strength, radius, threshold
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    // ---- lights (env provides soft fill, so key + light hemi) ----
    scene.add(new THREE.HemisphereLight(0x9fc4e8, 0x35301f, 0.5));   // cool sky / warm earth fill
    const key = new THREE.DirectionalLight(0xffe2ad, 2.55);          // warm low sun
    key.position.set(-26, 30, 14); key.castShadow = true;            // lower angle = longer, softer shadows
    const smap = mobile ? 2048 : 3072; key.shadow.mapSize.set(smap, smap);
    key.shadow.camera.near = 1; key.shadow.camera.far = 120;
    const sc = key.shadow.camera as THREE.OrthographicCamera; const S = 26; sc.left = -S; sc.right = S; sc.top = S; sc.bottom = -S; sc.updateProjectionMatrix();
    key.shadow.bias = -0.0004; key.shadow.normalBias = 0.035; scene.add(key);
    const fill = new THREE.DirectionalLight(0x7fa6d6, 0.35); fill.position.set(20, 16, 22); scene.add(fill);   // cool bounce on shadow side
    const rim = new THREE.DirectionalLight(new THREE.Color(accent), 0.7); rim.position.set(18, 9, -18); scene.add(rim);  // accent backlight

    // ---- procedural textures ----
    const noiseTex = (base: number, varc: number, size = 256, reps = 8) => {
      const cv = document.createElement("canvas"); cv.width = cv.height = size; const c = cv.getContext("2d")!;
      const col = new THREE.Color(base); c.fillStyle = `rgb(${col.r * 255 | 0},${col.g * 255 | 0},${col.b * 255 | 0})`; c.fillRect(0, 0, size, size);
      for (let i = 0; i < size * size * 0.5; i++) { const x = Math.random() * size, y = Math.random() * size, d = (Math.random() - 0.5) * varc; const r = Math.max(0, Math.min(255, col.r * 255 + d)), g = Math.max(0, Math.min(255, col.g * 255 + d)), b = Math.max(0, Math.min(255, col.b * 255 + d * 0.6)); c.fillStyle = `rgba(${r | 0},${g | 0},${b | 0},0.5)`; c.fillRect(x, y, 1.4, 1.4); }
      for (let i = 0; i < 60; i++) { const x = Math.random() * size, y = Math.random() * size; c.fillStyle = `rgba(0,0,0,${Math.random() * 0.06})`; c.beginPath(); c.arc(x, y, 4 + Math.random() * 10, 0, 7); c.fill(); }
      const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(reps, reps); t.anisotropy = maxAniso; t.colorSpace = THREE.SRGBColorSpace; return t;
    };
    const waterNormal = (() => {
      const size = 128; const cv = document.createElement("canvas"); cv.width = cv.height = size; const c = cv.getContext("2d")!; const img = c.createImageData(size, size); const f = Math.PI * 2 * 4 / size;
      const hgt = (x: number, y: number) => Math.sin(x * f) * 0.5 + Math.cos(y * f * 1.3) * 0.5 + Math.sin((x + y) * f * 0.7) * 0.3;
      for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) { const dx = hgt(x + 1, y) - hgt(x - 1, y), dy = hgt(x, y + 1) - hgt(x, y - 1); const n = new THREE.Vector3(-dx, -dy, 1).normalize(); const i = (y * size + x) * 4; img.data[i] = (n.x * 0.5 + 0.5) * 255; img.data[i + 1] = (n.y * 0.5 + 0.5) * 255; img.data[i + 2] = (n.z * 0.5 + 0.5) * 255; img.data[i + 3] = 255; }
      c.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(cv); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(5, 5); return t;
    })();
    const grassTex = noiseTex(theme.grass, 46, 256, 9);

    // ---- materials (smooth-shaded, PBR) ----
    const std = (c: number, o: Partial<THREE.MeshStandardMaterialParameters> = {}) => new THREE.MeshStandardMaterial({ color: c, roughness: 0.85, metalness: 0.0, ...o });
    const pal = {
      grass: std(0xffffff, { map: grassTex, roughness: 0.95 }), grassDk: std(theme.grassDk, { roughness: 0.95 }), sand: std(theme.sand, { roughness: 0.95 }), dirt: std(theme.dirt, { roughness: 1 }),
      cliff: std(theme.cliff, { roughness: 1 }), rock: std(theme.rock, { roughness: 0.9, flatShading: true }),
      water: std(theme.water, { roughness: 0.12, metalness: 0.55, transparent: true, opacity: 0.92, normalMap: waterNormal, normalScale: new THREE.Vector2(0.35, 0.35), envMapIntensity: 1.4 }),
      foam: std(0xbfe0ea, { roughness: 0.5 }), path: std(0x9a8a66, { roughness: 1 }),
      stone: std(0x8d8676, { roughness: 0.9 }), stoneDk: std(0x6f6960, { roughness: 0.9 }), brick: std(0x9c5544, { roughness: 0.85 }), brickDk: std(0x7d4334, { roughness: 0.85 }),
      woodLt: std(0x8a6a44, { roughness: 0.8 }), wood: std(0x5a4026, { roughness: 0.85 }), woodDk: std(0x3e2c1a, { roughness: 0.85 }),
      roofRed: std(0xb23a2f, { roughness: 0.7 }), roofGrey: std(0x394049, { roughness: 0.65 }), slate: std(0x2c333d, { roughness: 0.55, metalness: 0.2 }),
      metal: std(0x9aa0a8, { metalness: 0.85, roughness: 0.32, envMapIntensity: 1.3 }), darkMetal: std(0x2c2f36, { metalness: 0.7, roughness: 0.4, envMapIntensity: 1.1 }),
      gold: std(0xf0c860, { metalness: 0.95, roughness: 0.22, envMapIntensity: 1.6 }), silver: std(0xc9cdd2, { metalness: 0.85, roughness: 0.28, envMapIntensity: 1.4 }),
      crop: std(0x9ec24a, { roughness: 0.9 }), crate: std(0x7a6038, { roughness: 0.85 }), canvas: std(0x7a8350, { roughness: 0.95 }), hedge: std(0x3f6b39, { roughness: 0.95 }),
      glassLit: std(0xffd98a, { emissive: 0xffb43c, emissiveIntensity: 1.5, roughness: 0.3 }), glass: std(0x2a4250, { metalness: 0.6, roughness: 0.15, envMapIntensity: 1.5 }),
      white: std(0xe8e4d8, { roughness: 0.8 }), red: std(0xb53a30, { roughness: 0.7 }), flag: std(new THREE.Color(accent).getHex(), { side: THREE.DoubleSide, roughness: 0.8 }),
      truck: std(0x46525e, { metalness: 0.55, roughness: 0.4, envMapIntensity: 1.2 }), accentMat: std(new THREE.Color(accent).getHex(), { roughness: 0.6 }),
      beacon: std(new THREE.Color(accent).getHex(), { emissive: new THREE.Color(accent), emissiveIntensity: 1.7, roughness: 0.4 }),  // glowing build markers (bloom)
      lamp: std(0xffd07a, { emissive: 0xffb43c, emissiveIntensity: 2.2, roughness: 0.3 }),  // warm street-lamp bulbs
    };
    const palList = Object.values(pal) as THREE.Material[];
    const shadowize = (o: THREE.Object3D) => o.traverse((m) => { const me = m as THREE.Mesh; if (me.isMesh) { me.castShadow = true; me.receiveShadow = true; } });

    // ---- geometry helpers ----
    const box = (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat); m.position.set(x, y, z); return m; };
    const rbox = (w: number, h: number, d: number, mat: THREE.Material, x = 0, y = 0, z = 0) => { const r = Math.max(0.03, Math.min(0.16, Math.min(w, h, d) / 2 - 0.02)); const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat); m.position.set(x, y, z); return m; };
    const cyl = (rt: number, rb: number, h: number, seg: number, mat: THREE.Material, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), mat); m.position.set(x, y, z); return m; };
    const grp = (...m: THREE.Object3D[]) => { const g = new THREE.Group(); m.forEach((x) => g.add(x)); return g; };
    const roof = (w: number, h: number, d: number, mat: THREE.Material, y: number) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(0.001, w * 0.72, h, 4), mat); m.rotation.y = Math.PI / 4; m.scale.z = d / (w * 0.72 * Math.SQRT2); m.position.y = y; return m; };
    const windows = (n: number, y: number, z: number, sp: number) => { const g = new THREE.Group(); for (let i = 0; i < n; i++) g.add(box(0.34, 0.46, 0.06, pal.glassLit, -((n - 1) / 2) * sp + i * sp, y, z)); return g; };

    // ---- big round terraced island ----
    const island = new THREE.Group(); scene.add(island);
    const ROUND = 18;
    const mkDisc = (rt: number, rb: number, h: number, y: number, mat: THREE.Material) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, 72), mat); m.position.y = y; m.receiveShadow = true; m.castShadow = true; island.add(m); };
    mkDisc(ROUND, ROUND, 1.0, 0, pal.grass);
    mkDisc(ROUND + 0.7, ROUND + 0.3, 0.5, -0.6, pal.sand);
    mkDisc(ROUND + 0.2, ROUND - 3, 1.8, -1.6, pal.dirt);
    mkDisc(ROUND - 2, ROUND - 8, 2.6, -3.6, pal.cliff);
    for (let i = 0; i < 50; i++) { const a = Math.random() * Math.PI * 2, rr = Math.random() * (ROUND - 1.5); const p = new THREE.Mesh(new THREE.CylinderGeometry(0.6 + Math.random() * 1.1, 0.6, 0.12, 8), Math.random() < 0.5 ? pal.grassDk : pal.grass); p.position.set(Math.cos(a) * rr, 0.55, Math.sin(a) * rr); island.add(p); }
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; const r = new THREE.Mesh(new THREE.DodecahedronGeometry(0.9 + Math.random() * 1.1, 0), pal.rock); r.position.set(Math.cos(a) * (ROUND - 1), -1.5 - Math.random() * 1.6, Math.sin(a) * (ROUND - 1)); r.rotation.set(Math.random(), Math.random(), Math.random()); r.castShadow = true; island.add(r); }

    // water + foam
    const waterGeo = new THREE.PlaneGeometry(190, 190, 36, 36); waterGeo.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(waterGeo, pal.water); water.position.y = -2.3; water.receiveShadow = true; scene.add(water);
    const wpos = waterGeo.attributes.position as THREE.BufferAttribute; const wbase = Float32Array.from(wpos.array as Float32Array);
    const foam = new THREE.Mesh(new THREE.RingGeometry(ROUND + 0.3, ROUND + 1.8, 60), pal.foam); foam.rotation.x = -Math.PI / 2; foam.position.y = -2.0; scene.add(foam);

    // streets
    const roadY = 0.54;
    const street = (w: number, d: number, x: number, z: number) => { const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.07, d), pal.path); m.position.set(x, roadY, z); m.receiveShadow = true; island.add(m); };
    const spanX = COLS * GX, spanZ = ROWS * GZ;
    for (let c = 0; c <= COLS; c++) street(1.1, spanZ + 1, (c - COLS / 2) * GX, 0);
    for (let r = 0; r <= ROWS; r++) street(spanX + 1, 1.1, 0, (r - ROWS / 2) * GZ);

    // themed perimeter
    const fence = new THREE.Group(); island.add(fence);
    if (theme.fence === "stone") {
      for (let i = 0; i < 8; i++) {
        const a = i / 8 * Math.PI * 2, tx = Math.cos(a) * (ROUND - 2.2), tz = Math.sin(a) * (ROUND - 2.2);
        const tw = grp(cyl(0.9, 1.05, 3.0, 14, pal.stone, 0, 1.5, 0), cyl(1.1, 1.1, 0.5, 14, pal.stoneDk, 0, 3.1, 0)); tw.position.set(tx, 0.5, tz); shadowize(tw); fence.add(tw);
        const a2 = (i + 1) / 8 * Math.PI * 2, nx = Math.cos(a2) * (ROUND - 2.2), nz = Math.sin(a2) * (ROUND - 2.2);
        const wall = rbox(0.7, 1.8, Math.hypot(nx - tx, nz - tz) - 1.6, pal.stone, (tx + nx) / 2, 1.4, (tz + nz) / 2); wall.rotation.y = -Math.atan2(nz - tz, nx - tx) + Math.PI / 2; wall.castShadow = true; wall.receiveShadow = true; fence.add(wall);
      }
    } else if (theme.fence === "palisade") {
      for (let i = 0; i < 80; i++) { const a = i / 80 * Math.PI * 2; const stake = cyl(0.12, 0.16, 1.4 + Math.random() * 0.3, 7, pal.wood, Math.cos(a) * (ROUND - 1.6), 0.7, Math.sin(a) * (ROUND - 1.6)); stake.castShadow = true; fence.add(stake); }
    } else if (theme.fence === "hedge") {
      for (let i = 0; i < 60; i++) { const a = i / 60 * Math.PI * 2; const h = rbox(0.9, 0.8, 0.9, pal.hedge, Math.cos(a) * (ROUND - 1.8), 0.4, Math.sin(a) * (ROUND - 1.8)); h.castShadow = true; fence.add(h); }
    }

    // themed trees
    const tree = (s: number) => {
      const g = new THREE.Group();
      if (theme.tree === "acacia") {
        g.add(cyl(0.1, 0.18, 1.7 * s, 7, pal.wood, 0, 0.85 * s, 0));
        const can = new THREE.Mesh(new THREE.CylinderGeometry(1.5 * s, 1.7 * s, 0.4 * s, 12), pal.grassDk); can.position.y = 1.8 * s; g.add(can);
        const can2 = new THREE.Mesh(new THREE.CylinderGeometry(1.0 * s, 1.2 * s, 0.35 * s, 12), pal.grass); can2.position.y = 2.05 * s; g.add(can2);
      } else if (theme.tree === "pine") {
        g.add(cyl(0.14, 0.2, 1.0 * s, 7, pal.wood, 0, 0.5 * s, 0));
        for (let i = 0; i < 4; i++) { const c = new THREE.Mesh(new THREE.ConeGeometry(1.0 * s - i * 0.18 * s, 0.9 * s, 12), i % 2 ? pal.grass : pal.grassDk); c.position.y = (1.0 + i * 0.5) * s; g.add(c); }
      } else {
        g.add(cyl(0.16, 0.24, 1.1 * s, 7, pal.wood, 0, 0.55 * s, 0));
        for (let i = 0; i < 3; i++) { const b = new THREE.Mesh(new THREE.IcosahedronGeometry(0.85 * s - i * 0.12 * s, 1), i % 2 ? pal.grass : pal.grassDk); b.position.set((Math.random() - 0.5) * 0.5, (1.4 + i * 0.4) * s, (Math.random() - 0.5) * 0.5); g.add(b); }
      }
      shadowize(g); return g;
    };
    for (let i = 0; i < 16; i++) { const a = Math.random() * Math.PI * 2, rr = ROUND - 2.5 - Math.random() * 2.5; const t = tree(0.7 + Math.random() * 0.5); t.position.set(Math.cos(a) * rr, 0.5, Math.sin(a) * rr); island.add(t); }

    // harbour
    const harbour = new THREE.Group();
    for (let i = 0; i < 6; i++) harbour.add(box(1.6, 0.18, 1.1, pal.wood, 0, 0.6, -i * 1.1));
    const ship = grp(rbox(2.8, 0.8, 1.1, pal.darkMetal, 0, 0.5, 0), rbox(1.1, 0.7, 0.9, pal.white, -0.2, 1.1, 0), cyl(0.2, 0.22, 1.2, 12, pal.red, 0.5, 1.3, 0)); ship.position.set(0, -2.1, -7); shadowize(ship); harbour.add(ship);
    harbour.position.set(0, 0, ROUND - 0.5); shadowize(harbour); island.add(harbour);

    // central monument
    const monument = grp(rbox(1.4, 0.4, 1.4, pal.stoneDk, 0, 0.2, 0), cyl(0.35, 0.5, 2.6, 4, pal.stone, 0, 1.5, 0), cyl(0.0, 0.35, 0.5, 4, pal.gold, 0, 3.0, 0), cyl(0.03, 0.03, 0.9, 6, pal.woodDk, 0, 3.6, 0), box(0.6, 0.4, 0.03, pal.flag, 0.3, 3.8, 0));
    monument.position.set(0, roadY, 0); shadowize(monument); island.add(monument);

    // plot pads + rings
    const padTop = 0.52;
    const pickables: THREE.Mesh[] = []; const rings: THREE.Mesh[] = [];
    const ringGeo = new THREE.RingGeometry(1.75, 2.1, 40);
    POS.forEach(([x, z], i) => {
      const pad = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 2.0, 0.24, 28), pal.stone); pad.position.set(x, padTop, z); pad.receiveShadow = true; island.add(pad);
      const trim = new THREE.Mesh(new THREE.TorusGeometry(1.9, 0.08, 8, 28), pal.stoneDk); trim.rotation.x = -Math.PI / 2; trim.position.set(x, padTop + 0.13, z); island.add(trim);
      const hit = new THREE.Mesh(new THREE.BoxGeometry(4.4, 0.4, 4.4), new THREE.MeshBasicMaterial({ visible: false })); hit.position.set(x, padTop + 0.2, z); hit.userData.index = i; island.add(hit); pickables.push(hit);
      const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(accent), transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false, fog: false })); ring.rotation.x = -Math.PI / 2; ring.position.set(x, padTop + 0.2, z); ring.visible = false; island.add(ring); rings.push(ring);
    });

    // accent glow beam under the selected plot — additive so bloom makes it shine
    const glow = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 1.7, 3.0, 24, 1, true),  // open-ended cone
      new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false, blending: THREE.AdditiveBlending, fog: false })
    );
    glow.visible = false; island.add(glow);

    // desktop hover ring (invisible until pointer hovers a pad)
    const hoverRing = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false, fog: false }));
    hoverRing.rotation.x = -Math.PI / 2; hoverRing.visible = false; island.add(hoverRing);

    // ---- street lamps at road intersections (warm bloom dots — great overhead) ----
    for (let c = 0; c <= COLS; c++) for (let r = 0; r <= ROWS; r++) {
      const lx = (c - COLS / 2) * GX, lz = (r - ROWS / 2) * GZ;
      const post = cyl(0.06, 0.08, 1.7, 8, pal.darkMetal, lx, roadY + 0.85, lz); post.castShadow = true; island.add(post);
      const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), pal.lamp); bulb.position.set(lx, roadY + 1.78, lz); island.add(bulb);
    }

    // ---- selection reticle: 4 rotating corner brackets on the active pad (military targeting) ----
    const reticleMat = new THREE.MeshBasicMaterial({ color: accent, transparent: true, opacity: 0.95, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, side: THREE.DoubleSide });
    const reticle = new THREE.Group();
    const RS = 2.45, ARM = 0.7, TH = 0.09;                       // square half-extent · arm length · thickness
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const cxp = sx * RS, czp = sz * RS;
      const hb = new THREE.Mesh(new THREE.BoxGeometry(ARM, TH, TH), reticleMat); hb.position.set(cxp - sx * ARM / 2, 0, czp);
      const vb = new THREE.Mesh(new THREE.BoxGeometry(TH, TH, ARM), reticleMat); vb.position.set(cxp, 0, czp - sz * ARM / 2);
      reticle.add(hb, vb);
    }
    reticle.visible = false; island.add(reticle);

    // ---- drifting dust motes (additive, catches bloom for cinematic air) ----
    const dustTex = (() => { const cv = document.createElement("canvas"); cv.width = cv.height = 32; const c = cv.getContext("2d")!; const g = c.createRadialGradient(16, 16, 0, 16, 16, 16); g.addColorStop(0, "rgba(255,240,210,0.9)"); g.addColorStop(1, "rgba(255,240,210,0)"); c.fillStyle = g; c.fillRect(0, 0, 32, 32); return new THREE.CanvasTexture(cv); })();
    const DUST = mobile ? 90 : 150;
    const dustGeo = new THREE.BufferGeometry();
    const dpos = new Float32Array(DUST * 3); const dbase = new Float32Array(DUST);
    for (let i = 0; i < DUST; i++) { const a = Math.random() * Math.PI * 2, rr = Math.random() * (ROUND - 1); dpos[i * 3] = Math.cos(a) * rr; dpos[i * 3 + 1] = 1 + Math.random() * 9; dpos[i * 3 + 2] = Math.sin(a) * rr; dbase[i] = Math.random() * 10; }
    dustGeo.setAttribute("position", new THREE.BufferAttribute(dpos, 3));
    const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ map: dustTex, size: 0.42, transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true, fog: false }));
    scene.add(dust);

    // service trucks
    const trucks: { g: THREE.Group; route: { segs: { a: [number, number]; b: [number, number]; len: number }[]; total: number }; d: number; speed: number }[] = [];
    const makeRoute = (pts: [number, number][]) => { const segs = pts.map((p, i) => { const b = pts[(i + 1) % pts.length]; return { a: p, b, len: Math.hypot(b[0] - p[0], b[1] - p[1]) }; }); return { segs, total: segs.reduce((s, x) => s + x.len, 0) }; };
    const truckModel = () => { const g = grp(rbox(0.9, 0.4, 0.5, pal.truck, 0, 0.4, -0.1), rbox(0.4, 0.45, 0.5, pal.accentMat, 0.5, 0.42, -0.1), rbox(0.5, 0.25, 0.55, pal.crate, -0.2, 0.7, -0.1)); for (const sx of [-0.25, 0.45]) for (const sz of [-0.32, 0.12]) g.add(cyl(0.14, 0.14, 0.1, 14, pal.darkMetal, sx, 0.16, sz)); g.children.forEach((c) => { (c as THREE.Mesh).castShadow = true; }); g.scale.setScalar(0.9); return g; };
    const routes: [number, number][][] = [
      [[-12, -10], [12, -10], [12, 10], [-12, 10]],
      [[-(COLS / 2 - 1) * GX, -GZ], [(COLS / 2 - 1) * GX, -GZ], [(COLS / 2 - 1) * GX, GZ], [-(COLS / 2 - 1) * GX, GZ]],
      [[-GX, -spanZ / 2], [-GX, spanZ / 2], [GX, spanZ / 2], [GX, -spanZ / 2]],
    ];
    routes.forEach((pts, i) => { const n = i === 0 ? 2 : 1; const rt = makeRoute(pts); for (let k = 0; k < n; k++) { const g = truckModel(); island.add(g); trucks.push({ g, route: rt, d: (k / n) * rt.total, speed: (i === 0 ? 3.2 : 2.4) * (i % 2 ? -1 : 1) }); } });
    const alongRoute = (rt: { segs: { a: [number, number]; b: [number, number]; len: number }[]; total: number }, dist: number) => { let d = ((dist % rt.total) + rt.total) % rt.total; for (const s of rt.segs) { if (d <= s.len) { const t = d / s.len; return { x: s.a[0] + (s.b[0] - s.a[0]) * t, z: s.a[1] + (s.b[1] - s.a[1]) * t, ang: Math.atan2(s.b[1] - s.a[1], s.b[0] - s.a[0]) }; } d -= s.len; } return { x: rt.segs[0].a[0], z: rt.segs[0].a[1], ang: 0 }; };

    // ---- building layer ----
    const buildLayer = new THREE.Group(); island.add(buildLayer);
    let disposableMats: THREE.Material[] = [];
    const animated: { kind: "smoke" | "flag" | "spin" | "beacon"; obj: THREE.Object3D; base: number }[] = [];
    const smokeTex = (() => { const cv = document.createElement("canvas"); cv.width = cv.height = 64; const c = cv.getContext("2d")!; const g = c.createRadialGradient(32, 32, 1, 32, 32, 31); g.addColorStop(0, "rgba(228,228,232,0.85)"); g.addColorStop(1, "rgba(228,228,232,0)"); c.fillStyle = g; c.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(cv); })();
    const addSmoke = (parent: THREE.Object3D, x: number, y: number, z: number) => { const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: smokeTex, transparent: true, depthWrite: false, opacity: 0.6 })); s.scale.setScalar(1.0); s.position.set(x, y, z); parent.add(s); animated.push({ kind: "smoke", obj: s, base: y }); disposableMats.push(s.material); };

    function model(id: string, lvl: number): THREE.Group {
      const g = new THREE.Group();
      if (!id || lvl <= 0) {
        const ftorus = new THREE.Mesh(new THREE.TorusGeometry(1.05, 0.05, 8, 28), pal.beacon); ftorus.rotation.x = -Math.PI / 2; ftorus.position.y = 0.06; g.add(ftorus);  // foundation outline
        const plus = grp(box(0.7, 0.13, 0.13, pal.beacon, 0, 0, 0), box(0.13, 0.13, 0.7, pal.beacon, 0, 0, 0)); plus.position.y = 0.95; g.add(plus);  // floating build "+"
        animated.push({ kind: "beacon", obj: plus, base: 0.95 });
        return g;
      }
      const L = lvl;
      if (id === "industry") {
        const bh = 1.2 + L * 0.12; g.add(rbox(2.2, bh, 1.6, pal.brick, 0, bh / 2)); g.add(roof(2.5, 0.55, 1.8, pal.slate, bh + 0.28)); g.add(windows(3, bh * 0.55, 0.81, 0.65)); g.add(rbox(0.5, 0.7, 0.06, pal.woodDk, 0, 0.35, 0.81));
        const ch = 1 + Math.floor(L / 2); for (let i = 0; i < ch; i++) { const cx = -0.55 + i * 0.55, chh = 1.2 + L * 0.12; g.add(cyl(0.15, 0.19, chh, 16, pal.brickDk, cx, bh + chh / 2 - 0.2, -0.4)); addSmoke(g, cx, bh + chh + 0.2, -0.4); }
        g.add(cyl(0.45, 0.45, 0.8, 20, pal.metal, 1.3, bh + 0.35, 0.4)); return g;
      }
      if (id === "mine") {
        g.add(cyl(0.9, 0.65, 0.5, 16, pal.woodDk, 0, 0.25, 0)); const h = 1.5 + L * 0.18;
        for (const s of [-1, 1]) for (const d of [-1, 1]) { const leg = box(0.13, h, 0.13, pal.wood, s * 0.5, h / 2, d * 0.42); leg.rotation.z = -s * 0.15; g.add(leg); }
        g.add(box(1.2, 0.18, 1.0, pal.woodLt, 0, h, 0)); const wheel = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.08, 12, 28), pal.darkMetal); wheel.position.set(0, h + 0.15, 0); g.add(wheel); animated.push({ kind: "spin", obj: wheel, base: 1.4 });
        g.add(rbox(1.0, 0.7, 0.85, pal.brick, 1.45, 0.35, 0.4)); for (let i = 0; i < L; i++) { const ore = new THREE.Mesh(new THREE.DodecahedronGeometry(0.18, 0), pal.gold); ore.position.set(-1.3 + i * 0.3, 0.2, 1.1); g.add(ore); } return g;
      }
      if (id === "factory") {
        const bh = 1.2 + L * 0.14; g.add(rbox(2.4, bh, 1.8, pal.stone, 0, bh / 2));
        for (let i = 0; i < 4; i++) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.001, 0.45, 0.55, 4), pal.slate); t.rotation.y = Math.PI / 4; t.scale.z = 0.6; t.position.set(-0.8 + i * 0.55, bh + 0.28, 0); g.add(t); }
        g.add(windows(4, bh * 0.5, 0.91, 0.5)); g.add(box(0.13, 1.7 + L * 0.1, 0.13, pal.metal, 1.1, (1.7 + L * 0.1) / 2 + 0.2, 0.7)); g.add(box(1.4, 0.12, 0.12, pal.metal, 0.55, 1.8 + L * 0.1, 0.7));
        for (let i = 0; i < Math.min(L, 5); i++) g.add(rbox(0.4, 0.4, 0.4, pal.crate, -1.0, 0.2 + i * 0.42, 0.95)); addSmoke(g, 0.5, bh + 0.7, -0.5); return g;
      }
      if (id === "farm") {
        g.add(rbox(1.2, 0.85, 0.95, pal.red, -0.5, 0.42, -0.4)); const br = roof(1.4, 0.5, 1.0, pal.woodDk, 1.05); br.position.x = -0.5; g.add(br); g.add(box(0.4, 0.5, 0.05, pal.woodDk, -0.5, 0.5, 0.09));
        g.add(cyl(0.28, 0.28, 0.9 + L * 0.06, 20, pal.silver, 0.35, 0.45 + L * 0.03, -0.5)); g.add(cyl(0.0, 0.3, 0.32, 20, pal.metal, 0.35, 0.9 + L * 0.06 + 0.16, -0.5));
        const wm = new THREE.Group(); wm.add(cyl(0.1, 0.13, 1.3, 8, pal.woodLt, 0, 0.65, 0)); const blades = new THREE.Group(); for (let i = 0; i < 4; i++) { const b = box(0.1, 0.85, 0.04, pal.white, 0, 0.42, 0); b.rotation.z = i * Math.PI / 2; blades.add(b); } blades.position.set(0, 1.3, 0.16); wm.add(blades); animated.push({ kind: "spin", obj: blades, base: 0.9 }); wm.position.set(1.25, 0, 0.5); g.add(wm);
        for (let i = 0; i < Math.min(L, 6); i++) g.add(box(1.9, 0.12, 0.16, pal.crop, 0, 0.1, 0.95 - i * 0.28)); return g;
      }
      if (id === "rail") {
        for (let i = 0; i < 7; i++) g.add(box(2.2, 0.1, 0.18, pal.woodDk, 0, 0.05, -1.1 + i * 0.4)); for (const s of [-0.5, 0.5]) g.add(box(0.08, 0.1, 2.8, pal.silver, s, 0.14, 0));
        g.add(rbox(1.1, 0.85, 0.95, pal.brick, -1.1, 0.42, 0.6)); const rr = roof(1.3, 0.4, 1.1, pal.roofRed, 1.0); rr.position.set(-1.1, 1.0, 0.6); g.add(rr); g.add(box(0.28, 0.28, 0.06, pal.glassLit, -1.1, 0.55, 1.09));
        const eng = grp(rbox(0.55, 0.45, 1.0, pal.darkMetal, 0, 0.38, 0), rbox(0.45, 0.38, 0.45, pal.red, 0, 0.7, 0.2), cyl(0.11, 0.13, 0.38, 12, pal.darkMetal, 0, 0.9, 0.38)); for (let i = 0; i < Math.min(L, 3); i++) eng.add(rbox(0.45, 0.38, 0.65, pal.crate, 0, 0.32, -0.85 - i * 0.75)); eng.position.set(0.5, 0, 0.3); g.add(eng); addSmoke(g, 0.5, 1.2, 0.7); return g;
      }
      if (id === "barracks") {
        const tents = Math.min(2 + L, 7); for (let i = 0; i < tents; i++) { const tx = -0.9 + (i % 3) * 0.9, tz = -0.6 + Math.floor(i / 3) * 0.9; const tent = new THREE.Mesh(new THREE.CylinderGeometry(0.001, 0.46, 0.65, 4), pal.canvas); tent.rotation.y = Math.PI / 4; tent.position.set(tx, 0.32, tz); g.add(tent); }
        g.add(rbox(1.0, 0.65, 0.85, pal.woodLt, 1.05, 0.32, -0.55)); const hr = roof(1.2, 0.38, 0.95, pal.roofGrey, 0.82); hr.position.set(1.05, 0.82, -0.55); g.add(hr);
        const tw = grp(box(0.45, 1.7, 0.45, pal.wood, 0, 0.85, 0), rbox(0.75, 0.45, 0.75, pal.woodLt, 0, 1.8, 0), roof(0.85, 0.38, 0.85, pal.roofGrey, 2.2)); tw.position.set(-1.2, 0, 0.85); g.add(tw);
        g.add(cyl(0.05, 0.05, 1.9, 8, pal.woodDk, 0.95, 0.95, 0.85)); const flag = box(0.75, 0.48, 0.04, pal.flag, 1.34, 1.55, 0.85); g.add(flag); animated.push({ kind: "flag", obj: flag, base: 0 }); return g;
      }
      return g;
    }

    const clearBuild = () => { animated.length = 0; while (buildLayer.children.length) { const c = buildLayer.children.pop()!; c.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); }); } disposableMats.forEach((m) => m.dispose()); disposableMats = []; };
    const prevSig: string[] = new Array(POS.length).fill("\u0000");  // last [type:level] per plot
    const spawns: { obj: THREE.Object3D; t0: number }[] = [];        // buildings mid pop-in
    let lastPlotsRef: Plot[] | null = null;                          // ref-compare to skip needless rebuilds
    let selModel: THREE.Object3D | null = null;                      // selected building (for bob)
    let selIndex: number | null = null;

    const applySelection = (sel: number | null, acc: string) => {
      rings.forEach((r, i) => { r.visible = i === sel; (r.material as THREE.MeshBasicMaterial).color.set(acc); });
      if (selModel) selModel.position.y = padTop + 0.13;             // reset previous bob
      selIndex = sel;
      selModel = sel != null ? (buildLayer.children[sel] as THREE.Object3D) : null;
      if (sel == null) glow.visible = false;
      else { const [gx, gz] = POS[sel]; glow.position.set(gx, padTop + 1.4, gz); (glow.material as THREE.MeshBasicMaterial).color.set(acc); glow.visible = true; }
      reticleMat.color.set(acc);
      if (sel == null) reticle.visible = false;
      else { const [rx, rz] = POS[sel]; reticle.position.set(rx, padTop + 0.26, rz); reticle.visible = true; }
      focusPlot(sel);                                                // fly camera to it
    };

    const rebuild = (pl: Plot[], sel: number | null, acc: string) => {
      if (pl !== lastPlotsRef) {                                     // only recreate models when plots actually change
        clearBuild();
        POS.forEach(([x, z], i) => {
          const p = pl?.[i]; const sig = `${p?.type || ""}:${p?.level || 0}`;
          const m = model(p?.type || "", p?.level || 0); m.position.set(x, padTop + 0.13, z); shadowize(m); buildLayer.add(m);
          if (sig !== prevSig[i]) { m.scale.setScalar(0.001); spawns.push({ obj: m, t0: performance.now() }); prevSig[i] = sig; } // pop-in only changed plots
        });
        pal.flag.color.set(acc); pal.accentMat.color.set(acc); pal.beacon.color.set(acc); (pal.beacon as THREE.MeshStandardMaterial).emissive.set(acc); reticleMat.color.set(acc); rim.color.set(acc);
        lastPlotsRef = pl;
      }
      applySelection(sel, acc);
    };
    api.current = { rebuild }; rebuild(plots, selected, accent);

    // ---- interaction: pan / pinch-zoom / tap-select ----
    const ray = new THREE.Raycaster(); const ndc = new THREE.Vector2();
    const pointers = new Map<number, { x: number; y: number }>();
    let panLast: { x: number; y: number } | null = null, pinchLast = 0, moved = 0, downPt: { x: number; y: number } | null = null;
    const pick = (cx: number, cy: number) => { const r = renderer.domElement.getBoundingClientRect(); ndc.x = ((cx - r.left) / r.width) * 2 - 1; ndc.y = -((cy - r.top) / r.height) * 2 + 1; ray.setFromCamera(ndc, camera); const h = ray.intersectObjects(pickables, false); return h.length ? (h[0].object.userData.index as number) : null; };
    const panBy = (dx: number, dy: number) => { const k = 0.045 * zoom * aspectF(); target.x = Math.max(-PAN, Math.min(PAN, target.x - dx * k)); target.z = Math.max(-PAN, Math.min(PAN, target.z - dy * k)); lastInput = performance.now(); }; // tick eases the camera there
    const zoomBy = (ratio: number) => { zoom = Math.max(0.5, Math.min(1.6, zoom / ratio)); lastInput = performance.now(); };
    const el = renderer.domElement; el.style.touchAction = "none"; el.style.cursor = "grab";
    const onDown = (e: PointerEvent) => { pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); el.setPointerCapture?.(e.pointerId); if (pointers.size === 1) { panLast = { x: e.clientX, y: e.clientY }; downPt = { x: e.clientX, y: e.clientY }; moved = 0; } else { panLast = null; pinchLast = 0; } };
    const onMove = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return; pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (pointers.size === 1 && panLast) { const dx = e.clientX - panLast.x, dy = e.clientY - panLast.y; panLast = { x: e.clientX, y: e.clientY }; moved += Math.abs(dx) + Math.abs(dy); panBy(dx, dy); }
      else if (pointers.size >= 2) { const v = [...pointers.values()]; const d = Math.hypot(v[0].x - v[1].x, v[0].y - v[1].y); if (pinchLast) zoomBy(d / pinchLast); pinchLast = d; moved += 999; }
    };
    const onUp = (e: PointerEvent) => {
      const single = pointers.size === 1; pointers.delete(e.pointerId);
      if (pointers.size < 2) pinchLast = 0;
      if (pointers.size === 0) { if (single && moved < 8 && downPt) onSelectRef.current(pick(downPt.x, downPt.y)); panLast = null; }
      else { const v = [...pointers.values()][0]; panLast = { x: v.x, y: v.y }; }
    };
    const onWheel = (e: WheelEvent) => { e.preventDefault(); zoomBy(1 - e.deltaY * 0.0012); };
    el.addEventListener("pointerdown", onDown); el.addEventListener("pointermove", onMove); el.addEventListener("pointerup", onUp); el.addEventListener("pointercancel", onUp); el.addEventListener("wheel", onWheel, { passive: false });

    // desktop hover highlight — no-op on touch (pointermove only fires with a button down there)
    const onHover = (e: PointerEvent) => {
      if (pointers.size > 0) return;                       // ignore while dragging/pinching
      const i = pick(e.clientX, e.clientY);
      el.style.cursor = i != null ? "pointer" : "grab";
      if (i != null && i !== selIndex) { const [hx, hz] = POS[i]; hoverRing.position.set(hx, padTop + 0.21, hz); hoverRing.visible = true; }
      else hoverRing.visible = false;
    };
    el.addEventListener("pointermove", onHover);

    // ---- animate ----
    let raf = 0; const clock = new THREE.Clock(); let readyFired = false;
    const tick = () => {
      const t = clock.getElapsedTime(), dt = Math.min(0.05, clock.getDelta());

      // ---- camera: ease toward goal + gentle idle orbit ----
      const idleN = (performance.now() - lastInput) > 4000;                                  // drift in after 4s untouched
      orbit = THREE.MathUtils.lerp(orbit, idleN ? Math.sin(t * 0.18) * 0.16 : 0, 0.02);
      curZoom = THREE.MathUtils.lerp(curZoom, zoom, 0.12);
      camPos.lerp(goalPos(_v), 0.14); camera.position.copy(camPos);
      curLook.x = THREE.MathUtils.lerp(curLook.x, target.x, 0.14);
      curLook.z = THREE.MathUtils.lerp(curLook.z, target.z, 0.14);
      camera.lookAt(curLook);

      // ---- building spawn pop-in (overshoot, 0.42s) ----
      for (let i = spawns.length - 1; i >= 0; i--) {
        const sp = spawns[i]; const k = (performance.now() - sp.t0) / 420;
        if (k >= 1) { sp.obj.scale.setScalar(1); spawns.splice(i, 1); }
        else sp.obj.scale.setScalar(Math.max(0.001, easeOutBack(k)));
      }

      // ---- selected bob + glow pulse + reticle spin + hover-ring fade ----
      if (selModel) selModel.position.y = padTop + 0.13 + Math.sin(t * 3) * 0.06;
      if (glow.visible) (glow.material as THREE.MeshBasicMaterial).opacity = 0.12 + Math.sin(t * 4) * 0.06;
      if (reticle.visible) reticle.rotation.y = t * 0.5;
      { const hm = hoverRing.material as THREE.MeshBasicMaterial; hm.opacity = THREE.MathUtils.lerp(hm.opacity, hoverRing.visible ? 0.32 : 0, 0.2); }

      // ---- drifting dust motes ----
      const dp = dustGeo.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < DUST; i++) { let y = dp.getY(i) + dt * 0.25; if (y > 11) y = 1; dp.setY(i, y); dp.setX(i, dp.getX(i) + Math.sin(t * 0.3 + dbase[i]) * dt * 0.08); } dp.needsUpdate = true;
      for (let i = 0; i < wpos.count; i++) { const x = wbase[i * 3], z = wbase[i * 3 + 2]; wpos.setY(i, Math.sin(x * 0.15 + t) * 0.12 + Math.cos(z * 0.2 + t * 0.8) * 0.12); } wpos.needsUpdate = true;
      waterNormal.offset.set(t * 0.018, t * 0.012);
      for (const tr of trucks) { tr.d += tr.speed * dt; const p = alongRoute(tr.route, tr.d); tr.g.position.set(p.x, roadY + 0.05, p.z); tr.g.rotation.y = -p.ang + (tr.speed < 0 ? Math.PI / 2 : -Math.PI / 2) + Math.PI; }
      for (const a of animated) {
        if (a.kind === "smoke") { const s = a.obj as THREE.Sprite; const ph = (t * 0.4 + a.base) % 1; s.position.y = a.base + ph * 1.3; (s.material as THREE.SpriteMaterial).opacity = 0.5 * (1 - ph); s.scale.setScalar(0.6 + ph * 1.2); }
        else if (a.kind === "spin") a.obj.rotation.z = t * a.base;
        else if (a.kind === "beacon") { a.obj.position.y = a.base + Math.sin(t * 2 + a.obj.position.x) * 0.12; a.obj.rotation.y = t * 0.8; }
        else { a.obj.rotation.y = Math.sin(t * 4 + a.obj.position.z) * 0.35; a.obj.scale.x = 1 + Math.sin(t * 8) * 0.08; }
      }
      rings.forEach((r) => { if (r.visible) { (r.material as THREE.MeshBasicMaterial).opacity = 0.55 + Math.sin(t * 4) * 0.35; r.scale.setScalar(1 + Math.sin(t * 4) * 0.04); } });
      composer.render();
      if (!readyFired) { readyFired = true; onReadyRef.current?.(); }   // signal first frame painted
      raf = requestAnimationFrame(tick);
    };
    tick();

    const resize = () => { W = mount.clientWidth || 360; H = mount.clientHeight || 480; renderer.setSize(W, H); composer.setSize(W, H); place(); };
    const ro = new ResizeObserver(resize); ro.observe(mount);

    return () => {
      cancelAnimationFrame(raf); ro.disconnect();
      el.removeEventListener("pointerdown", onDown); el.removeEventListener("pointermove", onMove); el.removeEventListener("pointermove", onHover); el.removeEventListener("pointerup", onUp); el.removeEventListener("pointercancel", onUp); el.removeEventListener("wheel", onWheel);
      clearBuild();
      scene.traverse((o) => { const m = o as THREE.Mesh; if (m.geometry) m.geometry.dispose(); });
      palList.forEach((m) => m.dispose()); rings.forEach((r) => (r.material as THREE.Material).dispose());
      grassTex.dispose(); waterNormal.dispose(); smokeTex.dispose();
      (glow.material as THREE.Material).dispose(); (hoverRing.material as THREE.Material).dispose();
      reticleMat.dispose(); dustTex.dispose(); (dust.material as THREE.Material).dispose();
      (sky.material as THREE.Material).dispose(); (sun.material as THREE.Material).dispose(); sunTex.dispose();
      composer.dispose(); envRT.dispose(); pmrem.dispose(); renderer.dispose();
      if (el.parentNode) el.parentNode.removeChild(el); api.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nation]);

  useEffect(() => { api.current?.rebuild(plots, selected, accent); }, [plots, selected, accent]);

  return <div ref={ref} style={{ width: "100%", height: "100%" }} />;
}