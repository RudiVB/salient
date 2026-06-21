"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { Instance, computeStats, simulate, Combatant } from "@/lib/engine";
import { getUnitTexture, makeShadowTexture } from "@/lib/sprites";
import { Kind } from "@/lib/catalog";

// world-space size (w,h) of each unit billboard, by archetype
const SIZE: Record<Kind, { w: number; h: number; fly?: boolean }> = {
  soldier:   { w: 1.7, h: 2.2 },
  gas:       { w: 1.7, h: 2.2 },
  tank:      { w: 3.4, h: 2.0 },
  artillery: { w: 2.6, h: 1.9 },
  plane:     { w: 3.0, h: 1.6, fly: true },
  car:       { w: 2.8, h: 1.7 },
  medic:     { w: 1.7, h: 2.2 },
};

export default function Battle3D({
  playerArmy, enemyArmy, onComplete,
}: { playerArmy: Instance[]; enemyArmy: Instance[]; onComplete: (w: "P" | "E" | "D") => void }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const doneRef = useRef(false);

  useEffect(() => {
    const mount = mountRef.current!;
    const W = mount.clientWidth || 800, H = mount.clientHeight || 460;

    /* renderer */
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W, H);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    mount.appendChild(renderer.domElement);

    /* scene + fog */
    const scene = new THREE.Scene();
    const FOG = new THREE.Color("#7d8ba6");
    scene.background = FOG.clone();
    scene.fog = new THREE.Fog(FOG, 24, 60);

    /* camera */
    const camera = new THREE.PerspectiveCamera(55, W / H, 0.1, 200);
    const camBase = new THREE.Vector3(0, 9, 23);
    camera.position.copy(camBase);
    camera.lookAt(0, 1.2, 0);

    /* lights */
    scene.add(new THREE.HemisphereLight("#aebdd6", "#1c232e", 0.9));
    const sun = new THREE.DirectionalLight("#dfe8ff", 1.5);
    sun.position.set(-12, 16, 8);
    sun.castShadow = true;
    sun.shadow.mapSize.set(2048, 2048);
    sun.shadow.camera.near = 1; sun.shadow.camera.far = 60;
    sun.shadow.camera.left = -22; sun.shadow.camera.right = 22;
    sun.shadow.camera.top = 16; sun.shadow.camera.bottom = -16;
    sun.shadow.bias = -0.0004;
    scene.add(sun);

    /* helpers */
    const mat = (c: string, o: any = {}) => new THREE.MeshStandardMaterial({ color: new THREE.Color(c), flatShading: true, roughness: 0.95, metalness: 0.05, ...o });
    const box = (w: number, h: number, d: number, m: THREE.Material) => { const me = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); me.castShadow = true; return me; };
    const cyl = (rt: number, rb: number, h: number, m: THREE.Material, seg = 10) => { const me = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); me.castShadow = true; return me; };

    /* ground + dressing */
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(80, 44), mat("#28323f", { roughness: 1 }));
    ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; scene.add(ground);
    for (let i = 0; i < 18; i++) {
      const r = 0.6 + Math.random() * 1.4;
      const cr = new THREE.Mesh(new THREE.CircleGeometry(r, 12), mat("#1d2531"));
      cr.rotation.x = -Math.PI / 2; cr.position.set((Math.random() - 0.5) * 26, 0.01, (Math.random() - 0.5) * 18);
      cr.receiveShadow = true; scene.add(cr);
    }
    const sand = mat("#46536a");
    for (const sx of [-12, 12]) for (let z = -9; z <= 9; z += 1.3) {
      const b = box(1.2, 0.7, 1.0, sand); b.position.set(sx + (Math.random() - 0.5) * 0.3, 0.35, z); b.rotation.y = Math.random() * 0.3; scene.add(b);
    }
    const wood = mat("#2e2618");
    for (let i = 0; i < 10; i++) { const p = cyl(0.05, 0.07, 1.2, wood, 6); p.position.set((Math.random() - 0.5) * 20, 0.6, (Math.random() - 0.5) * 16); scene.add(p); }
    for (const tx of [-7, 5, -3]) { const t = cyl(0.12, 0.2, 2.4 + Math.random(), wood, 6); t.position.set(tx, 1.2, -8 + Math.random() * 3); t.rotation.z = (Math.random() - 0.5) * 0.4; scene.add(t); }

    /* deterministic battle */
    const pStats = computeStats(playerArmy).units;
    const eStats = computeStats(enemyArmy).units;
    const combat = simulate(pStats, eStats);

    /* sprite-billboard units */
    const shadowTex = makeShadowTexture();
    const billboards: any[] = [];   // meshes we yaw toward the camera each frame
    const actors: Record<string, any> = {};

    function makeUnit(u: Combatant, side: "P" | "E") {
      const sz = SIZE[u.kind];
      const tex = getUnitTexture(u.id, u.kind, side);
      const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, alphaTest: 0.4, side: THREE.DoubleSide, depthWrite: true });
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(sz.w, sz.h), m);
      mesh.position.y = sz.h / 2;
      mesh.scale.x = side === "E" ? -1 : 1;   // mirror enemy to face the player
      billboards.push(mesh);

      const blob = new THREE.Mesh(new THREE.CircleGeometry(sz.w * 0.42, 16), new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }));
      blob.rotation.x = -Math.PI / 2; blob.position.y = 0.02;

      const g = new THREE.Group(); g.add(mesh); g.add(blob);
      return { g, mesh, mat: m, sz };
    }

    function place(list: Combatant[], side: "P" | "E") {
      const sign = side === "P" ? -1 : 1;
      list.forEach((u, i) => {
        const { g, mesh, mat: m, sz } = makeUnit(u, side);
        const row = i % 2, idx = Math.floor(i / 2);
        const startX = sign * (11 - row * 1.4);
        const z = (idx - list.length / 4) * 2.0 + (row ? 0.9 : 0);
        const baseY = sz.fly ? 4 + Math.random() : 0;
        g.position.set(startX, baseY, z);
        scene.add(g);

        let move: "advance" | "hold" | "crawl" | "fly" = "advance";
        if (u.kind === "tank") move = "crawl";
        else if (u.kind === "plane") move = "fly";
        else if (u.kind === "artillery") move = "hold";
        else if (u.role === "Support") move = "hold";
        const clashX = sign * 1.6 - sign * row * 0.9;

        actors[u.uid] = { uid: u.uid, g, mesh, mat: m, side, kind: u.kind, move, alive: true, dying: false, deathT: 0,
          startX, clashX, baseY, phase: Math.random() * 6.28, sz };
      });
    }
    place(pStats, "P"); place(eStats, "E");

    /* VFX pool */
    const fx: any[] = [];
    function tracer(from: THREE.Vector3, to: THREE.Vector3, color: string) {
      const g = new THREE.BufferGeometry().setFromPoints([from, to]);
      const line = new THREE.Line(g, new THREE.LineBasicMaterial({ color: new THREE.Color(color), transparent: true, opacity: 0.95 }));
      scene.add(line); let life = 0.14;
      fx.push({ update: (dt: number) => { life -= dt; (line.material as any).opacity = Math.max(0, life / 0.14); return life > 0; }, dispose: () => { scene.remove(line); g.dispose(); (line.material as any).dispose(); } });
    }
    function muzzle(pos: THREE.Vector3) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.14, 8, 8), new THREE.MeshBasicMaterial({ color: "#ffd27a", transparent: true }));
      m.position.copy(pos); scene.add(m); let life = 0.1;
      fx.push({ update: (dt: number) => { life -= dt; (m.material as any).opacity = Math.max(0, life / 0.1); m.scale.setScalar(1 + (0.1 - life) * 6); return life > 0; }, dispose: () => { scene.remove(m); m.geometry.dispose(); (m.material as any).dispose(); } });
    }
    let shake = 0;
    function explosion(pos: THREE.Vector3) {
      const light = new THREE.PointLight("#ffb060", 8, 11); light.position.copy(pos).add(new THREE.Vector3(0, 1, 0)); scene.add(light);
      let ll = 0.25; fx.push({ update: (dt: number) => { ll -= dt; light.intensity = Math.max(0, 8 * (ll / 0.25)); return ll > 0; }, dispose: () => scene.remove(light) });
      const fb = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 10), new THREE.MeshBasicMaterial({ color: "#ff8a3c", transparent: true }));
      fb.position.copy(pos).add(new THREE.Vector3(0, 0.6, 0)); scene.add(fb); let fl = 0.45;
      fx.push({ update: (dt: number) => { fl -= dt; const k = 1 - fl / 0.45; fb.scale.setScalar(0.6 + k * 2.6); (fb.material as any).opacity = Math.max(0, 1 - k); return fl > 0; }, dispose: () => { scene.remove(fb); fb.geometry.dispose(); (fb.material as any).dispose(); } });
      const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.5, 18), new THREE.MeshBasicMaterial({ color: "#3a2c1c", transparent: true, side: THREE.DoubleSide }));
      ring.rotation.x = -Math.PI / 2; ring.position.copy(pos).setY(0.03); scene.add(ring); let rl = 0.5;
      fx.push({ update: (dt: number) => { rl -= dt; const k = 1 - rl / 0.5; ring.scale.setScalar(1 + k * 4); (ring.material as any).opacity = Math.max(0, 0.7 - k * 0.7); return rl > 0; }, dispose: () => { scene.remove(ring); ring.geometry.dispose(); (ring.material as any).dispose(); } });
      for (let i = 0; i < 7; i++) {
        const d = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.12, 0.12), mat("#2e2518"));
        d.position.copy(pos).add(new THREE.Vector3(0, 0.4, 0)); scene.add(d);
        const v = new THREE.Vector3((Math.random() - 0.5) * 5, 3 + Math.random() * 3, (Math.random() - 0.5) * 5); let life = 0.9;
        fx.push({ update: (dt: number) => { life -= dt; v.y -= 14 * dt; d.position.addScaledVector(v, dt); d.rotation.x += dt * 5; if (d.position.y < 0.06) return false; return life > 0; }, dispose: () => { scene.remove(d); d.geometry.dispose(); } });
      }
      shake = 0.5;
    }
    function shell(from: THREE.Vector3, to: THREE.Vector3) {
      const m = new THREE.Mesh(new THREE.SphereGeometry(0.1, 8, 8), new THREE.MeshBasicMaterial({ color: "#1c1710" }));
      m.position.copy(from); scene.add(m); let t = 0; const dur = 0.55;
      fx.push({ update: (dt: number) => { t += dt; const k = Math.min(1, t / dur); m.position.lerpVectors(from, to, k); m.position.y += Math.sin(k * Math.PI) * 4; if (k >= 1) { explosion(to.clone()); return false; } return true; }, dispose: () => { scene.remove(m); m.geometry.dispose(); (m.material as any).dispose(); } });
    }

    const ADVANCE = 1.7;
    const EV_DT = combat.log.length > 60 ? 0.07 : 0.13;
    let evIndex = 0, elapsed = 0, finished = false, settleT = 0, rafId = 0;
    const clock = new THREE.Clock();
    const barrelTip = (a: any) => a.g.position.clone().add(new THREE.Vector3(a.side === "P" ? 0.6 : -0.6, a.sz.h * 0.45, 0));

    function frame() {
      rafId = requestAnimationFrame(frame);
      const dt = Math.min(0.05, clock.getDelta());
      elapsed += dt;
      const adv = Math.min(1, elapsed / ADVANCE);

      for (const k in actors) {
        const a = actors[k]; if (!a.alive && !a.dying) continue; const g = a.g;
        if (a.dying) {
          a.deathT += dt; const k2 = Math.min(1, a.deathT / 0.7);
          a.mesh.rotation.z = (a.side === "P" ? 1 : -1) * k2 * 1.3;
          a.mesh.position.y = a.sz.h / 2 - k2 * (a.sz.h * 0.35);
          a.mat.opacity = 1 - k2;
          if (k2 >= 1) { a.dying = false; g.visible = false; }
          continue;
        }
        if (a.move === "advance") g.position.x = THREE.MathUtils.lerp(a.startX, a.clashX, adv);
        else if (a.move === "crawl") g.position.x = THREE.MathUtils.lerp(a.startX, a.clashX * 0.7, Math.min(1, elapsed / (ADVANCE + 2)));
        else if (a.move === "fly") { g.position.x = (a.startX + elapsed * (a.side === "P" ? 5 : -5)); if (Math.abs(g.position.x) > 16) g.position.x = -Math.sign(g.position.x) * 16; g.position.y = a.baseY + Math.sin(elapsed * 2) * 0.4; }
        if (a.move !== "fly" && a.kind !== "tank" && a.kind !== "artillery") g.position.y = a.baseY + Math.abs(Math.sin(elapsed * 6 + a.phase)) * 0.05;
      }

      if (elapsed > ADVANCE) {
        const want = Math.floor((elapsed - ADVANCE) / EV_DT);
        while (evIndex < want && evIndex < combat.log.length) {
          const e = combat.log[evIndex++]; const A = actors[e.atk], T = actors[e.tgt];
          if (A && T && A.alive) {
            const from = barrelTip(A), to = T.g.position.clone().add(new THREE.Vector3(0, T.sz.h * 0.5, 0));
            if (e.atkKind === "artillery" || e.atkKind === "tank") shell(from, to);
            else { muzzle(from); tracer(from, to, e.atkSide === "P" ? "#8fd6ff" : "#ff9a6a"); }
          }
          if (e.died && T && T.alive) { T.alive = false; T.dying = true; T.deathT = 0; }
        }
        if (evIndex >= combat.log.length && !finished) finished = true;
      }

      for (let i = fx.length - 1; i >= 0; i--) if (!fx[i].update(dt)) { fx[i].dispose(); fx.splice(i, 1); }

      // billboard: yaw each unit sprite toward the camera
      for (const b of billboards) b.rotation.y = Math.atan2(camera.position.x - b.parent.position.x, camera.position.z - b.parent.position.z);

      shake = Math.max(0, shake - dt * 2);
      camera.position.set(camBase.x + Math.sin(elapsed * 0.12) * 1.5 + (Math.random() - 0.5) * shake, camBase.y + (Math.random() - 0.5) * shake, camBase.z + Math.cos(elapsed * 0.1) * 0.8);
      camera.lookAt(0, 1.2, 0);
      renderer.render(scene, camera);

      if (finished) { settleT += dt; if (settleT > 1.0 && !doneRef.current) { doneRef.current = true; onComplete(combat.winner); } }
    }
    frame();

    const onResize = () => { const w = mount.clientWidth, h = mount.clientHeight || 460; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); };
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(rafId);
      window.removeEventListener("resize", onResize);
      scene.traverse((o: any) => { if (o.geometry) o.geometry.dispose(); if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m: any) => m.dispose()); });
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <div ref={mountRef} style={{ width: "100%", height: 460, borderRadius: 14, overflow: "hidden", background: "#7d8ba6" }} />;
}
