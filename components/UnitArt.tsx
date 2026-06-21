"use client";
import { useEffect, useRef, useState } from "react";
import { Kind } from "@/lib/catalog";
import { drawUnitPlaceholder, unitArtUrl } from "@/lib/art";

// Renders a unit's artwork for the 2D UI. Tries the real PNG; if missing, draws
// the same placeholder silhouette the 3D battle uses — so cards always match.
export default function UnitArt({ id, kind, side = "P", size = 92, className }: { id: string; kind: Kind; side?: "P" | "E"; size?: number; className?: string }) {
  const [failed, setFailed] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => { if (failed && canvasRef.current) drawUnitPlaceholder(canvasRef.current, kind, side); }, [failed, kind, side]);

  const style: React.CSSProperties = className ? {} : { width: size, height: size, objectFit: "contain", display: "block",
    filter: "drop-shadow(0 5px 4px rgba(0,0,0,.45))" };

  if (failed) return <canvas ref={canvasRef} width={256} height={256} className={className} style={style} />;
  return <img src={unitArtUrl(id)} onError={() => setFailed(true)} alt="" className={className} style={style} />;
}
