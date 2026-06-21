"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";

/**
 * PolyScene — reusable low-poly WW1 diorama backdrop (vanilla three.js).
 * components/PolyScene.tsx
 *
 * Renders faceted cratered terrain, a wrecked tank, splintered trees, dawn
 * lighting, drifting fog + embers, with a slow camera drift. Transparent
 * canvas (alpha) so a CSS sky behind it shows through above the horizon.
 *
 * Props: className (size it with CSS — fills its container).
 */
export default function PolyScene({ className }: { className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const mount = ref.current!;
    let W = mount.clientWidth || 800, H = mount.clientHeight || 500;

    // ---- renderer (transparent) ----
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.6));
    renderer.setSize(W, H);
    mount.appendChild(renderer.domElement);

    // ---- scene + fog (cold dawn) ----
    const scene = new THREE.Scene();
    const FOG = new THREE.Color("#16243a");
    scene.fog = new THREE.Fog(FOG, 22, 64);

    const camera = new THREE.PerspectiveCamera(46, W / H, 0.1, 200);
    camera.position.set(0, 6.5, 20);
    camera.lookAt(0, 1.5, -4);

    // ---- lights ----
    scene.add(new THREE.HemisphereLight(0x3a5e74, 0x0a0f1a, 0.85));        // sky / ground
    const key = new THREE.DirectionalLight(0xcfe0ea, 1.15);                // cool dawn key
    key.position.set(-8, 10, 6);
    scene.add(key);
    const rim = new THREE.DirectionalLight(0x56b9cf, 0.35);                // steel rim
    rim.position.set(6, 4, -10);
    scene.add(rim);

    // ---- materials ----
    const matTerrain = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 1, metalness: 0 });
    const matSteel = new THREE.MeshStandardMaterial({ color: 0x14222e, flatShading: true, roughness: 0.85, metalness: 0.1 });
    const matDark = new THREE.MeshStandardMaterial({ color: 0x0a141d, flatShading: true, roughness: 1 });
    const matTree = new THREE.MeshStandardMaterial({ color: 0x152433, flatShading: true, roughness: 1 });

    // ---- terrain (faceted, cratered) ----
    const CX = -3, CZ = 2; // wreck / main crater centre
    const SIZE = 80, SEG = 64;
    const geo = new THREE.PlaneGeometry(SIZE, SIZE, SEG, SEG);
    geo.rotateX(-Math.PI / 2);
    const pos = geo.attributes.position as THREE.BufferAttribute;
    const col = new Float32Array(pos.count * 3);
    const cMud = new THREE.Color("#1c2a3a"), cSlate = new THREE.Color("#2a3a4f"), cFrost = new THREE.Color("#3c5066");
    const tmp = new THREE.Color();
    const height = (x: number, z: number) => {
      let y = Math.sin(x * 0.17) * 0.55 + Math.cos(z * 0.15) * 0.5 + Math.sin((x + z) * 0.08) * 0.8;
      y += Math.max(0, -z * 0.05);                                          // ridge to the back
      const d = Math.hypot(x - CX, z - CZ);
      if (d < 6.5) y -= (6.5 - d) * 0.5;                                    // main crater
      const d2 = Math.hypot(x - 9, z - 5);
      if (d2 < 3.5) y -= (3.5 - d2) * 0.45;                                 // small crater
      return y;
    };
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), z = pos.getZ(i);
      const y = height(x, z);
      pos.setY(i, y);
      const t = THREE.MathUtils.clamp((y + 1.6) / 3.4, 0, 1);              // colour by height
      tmp.copy(cMud).lerp(cSlate, t).lerp(cFrost, Math.max(0, t - 0.6) * 1.4);
      tmp.offsetHSL(0, 0, (Math.random() - 0.5) * 0.04);                   // subtle facet variation
      col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
    }
    geo.setAttribute("color", new THREE.BufferAttribute(col, 3));
    geo.computeVertexNormals();
    const terrain = new THREE.Mesh(geo, matTerrain);
    scene.add(terrain);

    // ---- low-poly wrecked tank ----
    const tank = new THREE.Group();
    const hull = new THREE.Mesh(new THREE.BoxGeometry(5, 1.5, 2.6), matSteel); hull.position.y = 0.9; tank.add(hull);
    const nose = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.5, 2.6), matSteel); nose.position.set(2.7, 1.3, 0); nose.rotation.z = -0.5; tank.add(nose);
    const cab = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.9, 1.5), matSteel); cab.position.set(-0.4, 1.9, 0); tank.add(cab);
    const trackL = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.8, 0.7), matDark); trackL.position.set(0, 0.45, 1.25); tank.add(trackL);
    const trackR = new THREE.Mesh(new THREE.BoxGeometry(5.6, 0.8, 0.7), matDark); trackR.position.set(0, 0.45, -1.25); tank.add(trackR);
    const gun = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 3, 6), matDark);
    gun.position.set(1.0, 1.0, 1.5); gun.rotation.set(0, 0, Math.PI / 2 - 0.5); tank.add(gun); // drooping barrel
    const ember = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xe0863c }));
    ember.position.set(-1.2, 1.5, 0); tank.add(ember);
    tank.position.set(CX, height(CX, CZ) + 0.5, CZ);
    tank.rotation.set(0.12, -0.6, 0.18);                                    // canted in the crater
    tank.scale.setScalar(0.9);
    scene.add(tank);

    // ---- splintered trees ----
    const treeSpots: [number, number, number][] = [[12, -6, 1], [-14, -4, 1.3], [7, -12, 1.1], [-9, 8, 0.8], [16, 4, 0.9], [-18, 2, 1.1]];
    for (const [x, z, s] of treeSpots) {
      const hgt = 2.4 * s + Math.random() * 1.2;
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * s, 0.28 * s, hgt, 5), matTree);
      trunk.position.set(x, height(x, z) + hgt / 2 - 0.2, z);
      trunk.rotation.z = (Math.random() - 0.5) * 0.3;
      scene.add(trunk);
    }

    // ---- horizon sun ----
    const sun = new THREE.Mesh(new THREE.CircleGeometry(7, 24),
      new THREE.MeshBasicMaterial({ color: 0xb9cdd8, transparent: true, opacity: 0.5, fog: false }));
    sun.position.set(-6, 5, -40); scene.add(sun);

    // ---- drifting embers (points) ----
    const N = 60, ep = new Float32Array(N * 3), ev: number[] = [];
    for (let i = 0; i < N; i++) {
      ep[i * 3] = (Math.random() - 0.5) * 40; ep[i * 3 + 1] = Math.random() * 12; ep[i * 3 + 2] = (Math.random() - 0.5) * 30 - 4;
      ev[i] = 0.4 + Math.random() * 0.8;
    }
    const eGeo = new THREE.BufferGeometry();
    eGeo.setAttribute("position", new THREE.BufferAttribute(ep, 3));
    const embers = new THREE.Points(eGeo, new THREE.PointsMaterial({ color: 0xf0c860, size: 0.18, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    scene.add(embers);

    // ---- animate ----
    let raf = 0; const clock = new THREE.Clock();
    const tick = () => {
      const t = clock.getElapsedTime();
      camera.position.x = Math.sin(t * 0.06) * 4.5;                         // slow drift
      camera.position.y = 6.5 + Math.sin(t * 0.09) * 0.5;
      camera.lookAt(0, 1.6, -4);
      ember.scale.setScalar(0.8 + Math.sin(t * 3) * 0.25);                  // smoulder pulse
      const ap = embers.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < N; i++) {
        let y = ap.getY(i) + ev[i] * 0.02;
        if (y > 13) { y = 0; ap.setX(i, (Math.random() - 0.5) * 40); }
        ap.setY(i, y);
      }
      ap.needsUpdate = true;
      renderer.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    // ---- resize ----
    const onResize = () => {
      W = mount.clientWidth || 800; H = mount.clientHeight || 500;
      camera.aspect = W / H; camera.updateProjectionMatrix(); renderer.setSize(W, H);
    };
    window.addEventListener("resize", onResize);

    // ---- cleanup ----
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach((x) => x.dispose());
      });
      renderer.dispose();
      if (renderer.domElement.parentNode) renderer.domElement.parentNode.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={ref} className={className} />;
}
