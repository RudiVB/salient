"use client";
import { useId } from "react";

/**
 * Flag — accurate 1916-era national flags as inline SVG. components/Flag.tsx
 * viewBox 0 0 60 40 (3:2). Usage: <Flag id="germany" className="..." />
 */
export function Flag({ id, className }: { id: string; className?: string }) {
  const raw = useId();
  const cid = "f" + raw.replace(/[:]/g, "");
  const common = { viewBox: "0 0 60 40", className, preserveAspectRatio: "none" as const };

  switch (id) {
    case "germany": // German Empire 1871–1918: black / white / red
      return (
        <svg {...common}>
          <rect width="60" height="13.33" fill="#000" />
          <rect y="13.33" width="60" height="13.34" fill="#fff" />
          <rect y="26.67" width="60" height="13.33" fill="#dd0000" />
        </svg>
      );

    case "france": // vertical blue / white / red
      return (
        <svg {...common}>
          <rect width="20" height="40" fill="#0055a4" />
          <rect x="20" width="20" height="40" fill="#fff" />
          <rect x="40" width="20" height="40" fill="#ef4135" />
        </svg>
      );

    case "russia": // Russian Empire civil flag: white / blue / red
      return (
        <svg {...common}>
          <rect width="60" height="13.33" fill="#fff" />
          <rect y="13.33" width="60" height="13.34" fill="#0039a6" />
          <rect y="26.67" width="60" height="13.33" fill="#d52b1e" />
        </svg>
      );

    case "austria": // Austria-Hungary (Austrian): red / white / red
      return (
        <svg {...common}>
          <rect width="60" height="13.33" fill="#c8102e" />
          <rect y="13.33" width="60" height="13.34" fill="#fff" />
          <rect y="26.67" width="60" height="13.33" fill="#c8102e" />
        </svg>
      );

    case "ottoman": // red field, white crescent + star
      return (
        <svg {...common}>
          <rect width="60" height="40" fill="#e30a17" />
          <circle cx="30" cy="20" r="9.5" fill="#fff" />
          <circle cx="33.5" cy="20" r="7.6" fill="#e30a17" />
          <path transform="translate(43 20)" fill="#fff"
            d="M0 -6 L1.36 -1.86 L5.71 -1.85 L2.19 0.71 L3.53 4.85 L0 2.3 L-3.53 4.85 L-2.19 0.71 L-5.71 -1.85 L-1.36 -1.86 Z" />
        </svg>
      );

    case "britain": // Union Jack (simplified, recognizable)
      return (
        <svg {...common}>
          <clipPath id={cid}><rect width="60" height="40" /></clipPath>
          <g clipPath={`url(#${cid})`}>
            <rect width="60" height="40" fill="#012169" />
            {/* white diagonals (St Andrew) */}
            <path d="M0 0 L60 40 M60 0 L0 40" stroke="#fff" strokeWidth="8" />
            {/* red diagonals (St Patrick) */}
            <path d="M0 0 L60 40 M60 0 L0 40" stroke="#c8102e" strokeWidth="3" />
            {/* white cross (St George border) */}
            <rect x="24" width="12" height="40" fill="#fff" />
            <rect y="14" width="60" height="12" fill="#fff" />
            {/* red cross */}
            <rect x="26" width="8" height="40" fill="#c8102e" />
            <rect y="16" width="60" height="8" fill="#c8102e" />
          </g>
        </svg>
      );

    case "italy": // green / white / red vertical
      return (<svg {...common}><rect width="20" height="40" fill="#009246" /><rect x="20" width="20" height="40" fill="#fff" /><rect x="40" width="20" height="40" fill="#ce2b37" /></svg>);

    case "belgium": // black / yellow / red vertical
      return (<svg {...common}><rect width="20" height="40" fill="#000" /><rect x="20" width="20" height="40" fill="#fae042" /><rect x="40" width="20" height="40" fill="#ed2939" /></svg>);

    case "romania": // blue / yellow / red vertical
      return (<svg {...common}><rect width="20" height="40" fill="#002b7f" /><rect x="20" width="20" height="40" fill="#fcd116" /><rect x="40" width="20" height="40" fill="#ce1126" /></svg>);

    case "serbia": // red / blue / white horizontal
      return (<svg {...common}><rect width="60" height="13.33" fill="#c6363c" /><rect y="13.33" width="60" height="13.34" fill="#0c4076" /><rect y="26.67" width="60" height="13.33" fill="#fff" /></svg>);

    case "bulgaria": // white / green / red horizontal
      return (<svg {...common}><rect width="60" height="13.33" fill="#fff" /><rect y="13.33" width="60" height="13.34" fill="#00966e" /><rect y="26.67" width="60" height="13.33" fill="#d62612" /></svg>);

    case "japan": // white field, red sun disc
      return (<svg {...common}><rect width="60" height="40" fill="#fff" /><circle cx="30" cy="20" r="11" fill="#bc002d" /></svg>);

    case "usa": { // 13 stripes + star canton
      const stripes = Array.from({ length: 13 }, (_, i) => (
        <rect key={i} y={i * (40 / 13)} width="60" height={40 / 13} fill={i % 2 === 0 ? "#b22234" : "#fff"} />));
      const stars: any[] = [];
      for (let r = 0; r < 5; r++) for (let c = 0; c < 5; c++)
        stars.push(<circle key={`${r}-${c}`} cx={3 + c * 4.2 + (r % 2 ? 2.1 : 0)} cy={3 + r * 3.7} r="0.8" fill="#fff" />);
      return (<svg {...common}>{stripes}<rect width="24" height={(40 / 13) * 7} fill="#3c3b6e" />{stars}</svg>);
    }

    case "southafrica": { // WW1 South African Red Ensign: red field, Union Jack canton, Union badge on the fly
      const c1 = cid + "a", c2 = cid + "b";
      return (
        <svg {...common}>
          <rect width="60" height="40" fill="#c8102e" />
          {/* canton: mini Union Jack (full jack scaled to the top-hoist quarter) */}
          <clipPath id={c1}><rect width="30" height="20" /></clipPath>
          <g clipPath={`url(#${c1})`}><g transform="scale(0.5)">
            <rect width="60" height="40" fill="#012169" />
            <path d="M0 0 L60 40 M60 0 L0 40" stroke="#fff" strokeWidth="8" />
            <path d="M0 0 L60 40 M60 0 L0 40" stroke="#c8102e" strokeWidth="3" />
            <rect x="24" width="12" height="40" fill="#fff" />
            <rect y="14" width="60" height="12" fill="#fff" />
            <rect x="26" width="8" height="40" fill="#c8102e" />
            <rect y="16" width="60" height="8" fill="#c8102e" />
          </g></g>
          {/* Union of South Africa badge (abstract quartered shield) */}
          <circle cx="44" cy="20" r="9" fill="#f0c860" />
          <clipPath id={c2}><circle cx="44" cy="20" r="7.4" /></clipPath>
          <g clipPath={`url(#${c2})`}>
            <rect x="36.6" y="12.6" width="7.4" height="7.4" fill="#007a4d" />
            <rect x="44" y="12.6" width="7.4" height="7.4" fill="#de3831" />
            <rect x="36.6" y="20" width="7.4" height="7.4" fill="#ff8200" />
            <rect x="44" y="20" width="7.4" height="7.4" fill="#002395" />
          </g>
          <path d="M44 12.6 V27.4 M36.6 20 H51.4" stroke="#f0c860" strokeWidth="0.9" />
        </svg>
      );
    }

    default:
      return <svg {...common}><rect width="60" height="40" fill="#222" /></svg>;
  }
}
