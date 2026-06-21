"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";
import earcut from "earcut";
import { TERRITORIES, latLonToXYZ, Owner } from "@/lib/world";

/**
 * WorldGlobe — low-poly planet with Risk-style territory nodes (vanilla three.js).
 * components/WorldGlobe.tsx
 *
 * Builds once on mount; recolours nodes when ownership/selection/accent change.
 * Props:
 *   accent      — player colour
 *   ownership   — id -> "player" | "enemy"
 *   selectedId  — currently selected territory
 *   attackable  — Set of enemy ids the player can attack (pulse)
 *   onSelect(id)
 */
export default function WorldGlobe({
  accent, ownership, selectedId, attackable, onSelect, colorMap,
}: {
  accent: string;
  ownership: Record<string, Owner>;
  selectedId: string | null;
  attackable: Set<string>;
  onSelect: (id: string) => void;
  colorMap?: Record<string, string>;   // territory id -> faction colour (overrides player/enemy)
}) {
  const mountRef = useRef<HTMLDivElement>(null);
  const nodesRef = useRef<Map<string, THREE.Mesh>>(new Map());

  // latest props for the animation loop / handlers (avoid stale closures)
  const accentRef = useRef(accent); accentRef.current = accent;
  const ownRef = useRef(ownership); ownRef.current = ownership;
  const cmRef = useRef(colorMap); cmRef.current = colorMap;
  const selRef = useRef(selectedId); selRef.current = selectedId;
  const atkRef = useRef(attackable); atkRef.current = attackable;
  const onSelRef = useRef(onSelect); onSelRef.current = onSelect;

  // ---- build scene once ----
  useEffect(() => {
    const mount = mountRef.current!;
    let disposed = false;
    let W = mount.clientWidth || 800, H = mount.clientHeight || 600;
    const R = 5;

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.setSize(W, H);
    mount.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, W / H, 0.1, 100);
    camera.position.set(0, 0, 15);

    scene.add(new THREE.HemisphereLight(0x4a6e84, 0x0a0f1a, 1.0));
    const key = new THREE.DirectionalLight(0xdfeaf2, 1.2); key.position.set(-6, 6, 8); scene.add(key);
    const rim = new THREE.DirectionalLight(0x56b9cf, 0.5); rim.position.set(8, -2, -6); scene.add(rim);

    const globe = new THREE.Group(); scene.add(globe);

    // ocean planet (faceted low-poly)
    const planetGeo = new THREE.IcosahedronGeometry(R, 4);
    const pcol = new Float32Array(planetGeo.attributes.position.count * 3);
    const oA = new THREE.Color("#0e2236"), oB = new THREE.Color("#16344c");
    const c = new THREE.Color();
    for (let i = 0; i < planetGeo.attributes.position.count; i++) {
      c.copy(oA).lerp(oB, Math.random()); pcol[i * 3] = c.r; pcol[i * 3 + 1] = c.g; pcol[i * 3 + 2] = c.b;
    }
    planetGeo.setAttribute("color", new THREE.BufferAttribute(pcol, 3));
    const planet = new THREE.Mesh(planetGeo, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0 }));
    globe.add(planet);

    // faint wireframe shell
    const wire = new THREE.Mesh(new THREE.IcosahedronGeometry(R * 1.001, 2),
      new THREE.MeshBasicMaterial({ color: 0x3a6e88, wireframe: true, transparent: true, opacity: 0.12 }));
    globe.add(wire);

    // ---- real countries: filled low-poly land + borders + ownership tint ----
    let landRecolor: (() => void) | null = null;
    const terrVecs = TERRITORIES.map((t) => ({ id: t.id, v: new THREE.Vector3(...latLonToXYZ(t.lat, t.lon, R)) }));
    const nearestTerr = (v: THREE.Vector3) => {
      let best = terrVecs[0].id, bd = Infinity;
      for (const tv of terrVecs) { const d = v.distanceToSquared(tv.v); if (d < bd) { bd = d; best = tv.id; } }
      return best;
    };
    fetch("/world.geo.json").then((r) => r.json()).then((geo: { polys: number[][][][] }) => {
      if (disposed) return;
      const lpos: number[] = [], lcol: number[] = [], lidx: number[] = [], bpos: number[] = [];
      const ranges: { start: number; count: number; terr: string; base: THREE.Color }[] = [];
      let base = 0; const tmpc = new THREE.Vector3(), cen = new THREE.Vector3();
      for (const rings of geo.polys) {
        const outer = rings[0], holes = rings.slice(1);
        for (const ring of rings) for (let i = 0; i < ring.length; i++) {
          const a = ring[i], b = ring[(i + 1) % ring.length];
          const pa = latLonToXYZ(a[1], a[0], R + 0.045), pb = latLonToXYZ(b[1], b[0], R + 0.045);
          bpos.push(pa[0], pa[1], pa[2], pb[0], pb[1], pb[2]);
        }
        const flat: number[] = [], holeIdx: number[] = [];
        for (const q of outer) flat.push(q[0], q[1]);
        for (const h of holes) { holeIdx.push(flat.length / 2); for (const q of h) flat.push(q[0], q[1]); }
        let tris: number[] = [];
        try { tris = earcut(flat, holeIdx.length ? holeIdx : undefined, 2); } catch { tris = []; }
        if (!tris.length) continue;
        const allPts: number[][] = ([outer, ...holes] as number[][][]).flat();
        cen.set(0, 0, 0);
        const baseTint = new THREE.Color().setHSL(0.34 + (Math.random() - 0.5) * 0.05, 0.27, 0.25 + Math.random() * 0.06);
        for (const q of allPts) {
          const v = latLonToXYZ(q[1], q[0], R + 0.03);
          lpos.push(v[0], v[1], v[2]); lcol.push(baseTint.r, baseTint.g, baseTint.b);
          cen.add(tmpc.set(v[0], v[1], v[2]));
        }
        for (const ti of tris) lidx.push(base + ti);
        cen.normalize().multiplyScalar(R);
        ranges.push({ start: base, count: allPts.length, terr: nearestTerr(cen), base: baseTint });
        base += allPts.length;
      }
      const lg = new THREE.BufferGeometry();
      lg.setAttribute("position", new THREE.Float32BufferAttribute(lpos, 3));
      const colAttr = new THREE.Float32BufferAttribute(lcol, 3);
      lg.setAttribute("color", colAttr);
      lg.setIndex(lidx); lg.computeVertexNormals();
      globe.add(new THREE.Mesh(lg, new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0, side: THREE.DoubleSide })));
      const bg = new THREE.BufferGeometry();
      bg.setAttribute("position", new THREE.Float32BufferAttribute(bpos, 3));
      globe.add(new THREE.LineSegments(bg, new THREE.LineBasicMaterial({ color: 0x0a1a12, transparent: true, opacity: 0.5 })));
      const arr = colAttr.array as Float32Array; const accC = new THREE.Color();
      landRecolor = () => {
        const own = ownRef.current; accC.set(accentRef.current); const cm = cmRef.current;
        for (const rg of ranges) {
          const c = cm && cm[rg.terr] ? new THREE.Color(cm[rg.terr]) : (own[rg.terr] === "player" ? accC : rg.base);
          for (let i = 0; i < rg.count; i++) { const k = (rg.start + i) * 3; arr[k] = c.r; arr[k + 1] = c.g; arr[k + 2] = c.b; }
        }
        colAttr.needsUpdate = true;
      };
      landRecolor();
    }).catch(() => {});

    // atmosphere glow
    const atmo = new THREE.Mesh(new THREE.SphereGeometry(R * 1.08, 32, 32),
      new THREE.MeshBasicMaterial({ color: 0x56b9cf, transparent: true, opacity: 0.06, side: THREE.BackSide }));
    scene.add(atmo);

    // adjacency arcs
    const seen = new Set<string>();
    const arcMat = new THREE.LineBasicMaterial({ color: 0x4a7388, transparent: true, opacity: 0.22 });
    for (const t of TERRITORIES) {
      const a = new THREE.Vector3(...latLonToXYZ(t.lat, t.lon, R + 0.05));
      for (const nId of t.neighbors) {
        const key2 = [t.id, nId].sort().join("|"); if (seen.has(key2)) continue; seen.add(key2);
        const nt = TERRITORIES.find((x) => x.id === nId)!;
        const b = new THREE.Vector3(...latLonToXYZ(nt.lat, nt.lon, R + 0.05));
        const mid = a.clone().add(b).multiplyScalar(0.5).normalize().multiplyScalar(R * 1.22);
        const curve = new THREE.QuadraticBezierCurve3(a, mid, b);
        const g = new THREE.BufferGeometry().setFromPoints(curve.getPoints(20));
        globe.add(new THREE.Line(g, arcMat));
      }
    }

    // territory nodes
    const nodeGeo = new THREE.OctahedronGeometry(0.2, 0);
    for (const t of TERRITORIES) {
      const m = new THREE.Mesh(nodeGeo, new THREE.MeshStandardMaterial({ flatShading: true, roughness: 0.6, emissive: 0x000000 }));
      m.position.set(...latLonToXYZ(t.lat, t.lon, R + 0.18));
      m.userData.id = t.id;
      globe.add(m);
      nodesRef.current.set(t.id, m);
      // little pin to the surface
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.18, 4), new THREE.MeshBasicMaterial({ color: 0x6f8aa0, transparent: true, opacity: 0.5 }));
      const surf = new THREE.Vector3(...latLonToXYZ(t.lat, t.lon, R + 0.09));
      pin.position.copy(surf); pin.lookAt(0, 0, 0); pin.rotateX(Math.PI / 2);
      globe.add(pin);
    }

    // ---- interaction: drag-rotate + click-select ----
    const ray = new THREE.Raycaster(); const ptr = new THREE.Vector2();
    let dragging = false, moved = 0, lx = 0, ly = 0;
    let velY = 0; // idle spin / inertia

    const down = (e: PointerEvent) => { dragging = true; moved = 0; lx = e.clientX; ly = e.clientY; };
    const move = (e: PointerEvent) => {
      if (!dragging) return;
      const dx = e.clientX - lx, dy = e.clientY - ly; lx = e.clientX; ly = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      globe.rotation.y += dx * 0.006; velY = dx * 0.006;
      globe.rotation.x = THREE.MathUtils.clamp(globe.rotation.x + dy * 0.006, -1.2, 1.2);
    };
    const up = (e: PointerEvent) => {
      if (dragging && moved < 6) {
        const r = renderer.domElement.getBoundingClientRect();
        ptr.x = ((e.clientX - r.left) / r.width) * 2 - 1;
        ptr.y = -((e.clientY - r.top) / r.height) * 2 + 1;
        ray.setFromCamera(ptr, camera);
        const hits = ray.intersectObjects([...nodesRef.current.values()], false);
        if (hits.length) onSelRef.current(hits[0].object.userData.id as string);
      }
      dragging = false;
    };
    const dom = renderer.domElement;
    dom.addEventListener("pointerdown", down);
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);

    // ---- animate ----
    let raf = 0; const clock = new THREE.Clock();
    const tick = () => {
      const t = clock.getElapsedTime();
      if (!dragging) { globe.rotation.y += velY; velY *= 0.94; if (Math.abs(velY) < 1e-4) velY = 0; }
      // pulse attackable nodes
      const atk = atkRef.current;
      nodesRef.current.forEach((m, id) => {
        const mat = m.material as THREE.MeshStandardMaterial;
        if (atk.has(id) && selRef.current !== id) {
          mat.emissive.setHex(0xe5414f); mat.emissiveIntensity = 0.4 + Math.sin(t * 4) * 0.35;
          m.rotation.y += 0.02;
        }
      });
      atmo.quaternion.copy(camera.quaternion);
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    const onResize = () => {
      W = mount.clientWidth || 800; H = mount.clientHeight || 600;
      camera.aspect = W / H; camera.updateProjectionMatrix(); renderer.setSize(W, H);
    };
    window.addEventListener("resize", onResize);

    // expose recolour to the update effect
    (mount as any).__recolor = () => recolor();
    function recolor() {
      const own = ownRef.current, sel = selRef.current, acc = new THREE.Color(accentRef.current), atk = atkRef.current, cm = cmRef.current;
      nodesRef.current.forEach((m, id) => {
        const mat = m.material as THREE.MeshStandardMaterial;
        const base = cm && cm[id] ? new THREE.Color(cm[id]) : (own[id] === "player" ? acc : new THREE.Color(0xe5414f));
        mat.color.copy(base);
        if (sel === id) { mat.emissive.setHex(0xffffff); mat.emissiveIntensity = 0.6; m.scale.setScalar(1.8); }
        else { mat.emissiveIntensity = 0; mat.emissive.setHex(0x000000); m.scale.setScalar(atk.has(id) ? 1.3 : 1); }
      });
      if (landRecolor) landRecolor();
    }
    recolor();

    return () => {
      disposed = true;
      cancelAnimationFrame(raf);
      dom.removeEventListener("pointerdown", down);
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
      window.removeEventListener("resize", onResize);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose());
      });
      renderer.dispose();
      if (dom.parentNode) dom.parentNode.removeChild(dom);
      nodesRef.current.clear();
    };
  }, []);

  // recolour on state change
  useEffect(() => {
    const fn = (mountRef.current as any)?.__recolor;
    if (fn) fn();
  }, [ownership, selectedId, accent, attackable, colorMap]);

  return <div ref={mountRef} style={{ position: "absolute", inset: 0 }} />;
}
