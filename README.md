# Salient — 1916

A living-world WW1 strategy game. Build your homeland economy, raise and command an army, and conquer a world map that keeps fighting in **real time** — even while you're away.

Built with **Next.js + TypeScript** and **vanilla Three.js** (low-poly 3D), running fully client-side today (saves in `localStorage`), with a Supabase backend planned for multiplayer and cloud saves.

## Features

- **Tactical battles** — unit counters, terrain, in-battle abilities, and a visual rout, with per-regiment casualty reports.
- **Homeland builder** — a premium low-poly 3D town: industry, mines, factories, farms, rail and barracks on a nation-themed island. Feeds a Rand economy with food/starvation.
- **Living world map** — four AI great powers fight and expand on a 3D globe in real time. Your army defends your land; you can fortify, invade, and lose ground if you don't defend.
- **War Doctrine** — a tech tree of army-wide bonuses funded by battle research.
- **Commanders** — regiments that survive earn named heroes who level up, gain traits, and can fall in battle.
- **Onboarding** — a welcome briefing and a self-completing "Field Orders" checklist.

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| 3D | Three.js 0.165 (vanilla) + earcut |
| Hosting | Vercel |
| Backend (planned) | Supabase (Postgres + Realtime + Edge Functions) |

## Local development

```bash
npm install
npm run dev          # http://localhost:3000  (binds 0.0.0.0 for LAN testing)
npm run dev:local    # localhost only
npm run build        # production build
npm start            # serve the production build
```

Requires Node 18+.

## Deployment

Hosted on Vercel (zero-config for Next.js). Push to `main` to deploy. Environment
variables live in the Vercel dashboard — see `.env.example`. Single-player needs
no env; the Supabase keys are for the upcoming multiplayer/cloud-save work.

## Project layout

```
app/            Next.js routes + root layout
components/     screens (Hub, WorldMap, Homeland, Doctrine, Heroes…) + 3D scenes
lib/            game logic (store, economy, combat, doctrine, heroes, worldsim…)
```

## Status

Single-player is feature-complete (three gameplay pillars + homeland + onboarding).
Next up: Supabase-backed multiplayer (4-player sessions replacing AI factions).
