"use client";
import { useState, useEffect } from "react";
import MainMenu from "@/components/MainMenu";
import IntroSequence from "@/components/IntroSequence";
import NationSelect from "@/components/NationSelect";
import WorldMap from "@/components/WorldMap";
import HubScreen from "@/components/HubScreen";
import Barracks from "@/components/Barracks";
import TradeScreen from "@/components/TradeScreen";
import SettingsScreen from "@/components/SettingsScreen";
import OperationsScreen from "@/components/OperationsScreen";
import HomelandScreen from "@/components/HomelandScreen";
import DoctrineScreen from "@/components/DoctrineScreen";
import HeroesScreen from "@/components/HeroesScreen";
import LobbyScreen from "@/components/LobbyScreen";
import AuthScreen from "@/components/AuthScreen";
import MatchScreen from "@/components/MatchScreen";
import ProfileScreen from "@/components/ProfileScreen";
import type { Seat } from "@/lib/lobby";
import { findMyActiveSession, type ResumeInfo } from "@/lib/lobby";
import { useGame } from "@/lib/store";
import { fmt } from "@/lib/catalog";
import { initGlobalSfx, playMusic, stopMusic, type MusicName } from "@/lib/audio";

type Tab = "campaign" | "collection" | "battle";

// which music track plays on each screen ("intro" is omitted — it runs its own ambience)
const SCREEN_MUSIC: Record<string, MusicName> = {
  menu: "menuMusic", settings: "menuMusic", nation: "nationMusic",
  hub: "hubMusic", trade: "hubMusic", game: "hubMusic", homeland: "hubMusic",
  barracks: "barracksMusic", world: "worldMusic", lobby: "menuMusic", auth: "menuMusic", match: "worldMusic", profile: "menuMusic",
};

export default function Page() {
  const [screen, setScreen] = useState<"menu" | "intro" | "nation" | "hub" | "barracks" | "trade" | "world" | "game" | "settings" | "homeland" | "doctrine" | "heroes" | "lobby" | "auth" | "match" | "profile">("menu");
  const [match, setMatch] = useState<{ sessionId: string; seat: Seat; code: string } | null>(null);
  const [resume, setResume] = useState<ResumeInfo | null>(null);                    // detected rejoinable game
  const [lobbyResume, setLobbyResume] = useState<{ sessionId: string; seat: Seat; code: string } | null>(null);
  const [tab, setTab] = useState<Tab>("campaign");
  const game = useGame();

  useEffect(() => { initGlobalSfx(); }, []);                 // hover/click on every button, game-wide
  useEffect(() => {
    if (screen === "intro") { stopMusic(); return; }         // intro plays its own ambience
    playMusic(SCREEN_MUSIC[screen] || "menuMusic");
  }, [screen]);

  // detect a rejoinable lobby/match whenever we're on the title screen
  useEffect(() => {
    if (screen !== "menu") return;
    let alive = true;
    findMyActiveSession().then((r) => { if (alive) setResume(r); }).catch(() => {});
    return () => { alive = false; };
  }, [screen]);

  // route a Continue/Rejoin: live match → straight in; open lobby → into the lobby
  const handleResume = (r: ResumeInfo) => {
    if (r.status === "active") { setMatch({ sessionId: r.sessionId, seat: r.seat, code: r.code }); setScreen("match"); }
    else { setLobbyResume({ sessionId: r.sessionId, seat: r.seat, code: r.code }); setScreen("lobby"); }
  };

  const totalTroops = game.collection.reduce((s, u) => s + u.troops, 0);  const active = game.collection.filter((u) => u.troops > 0).length;

  if (screen === "menu") return (
    <MainMenu hasSave={!!game.position} onContinue={() => setScreen(game.nation ? "hub" : "nation")} onNew={() => { game.reset(); setScreen("intro"); }} onMultiplayer={() => { setLobbyResume(null); setScreen("lobby"); }} onAccount={() => setScreen("auth")} onProfile={() => setScreen("profile")} onSettings={() => setScreen("settings")} resume={resume} onResume={handleResume} />
  );

  if (screen === "auth") return (
    <AuthScreen onBack={() => setScreen("menu")} onDone={() => setScreen("menu")} />
  );

  if (screen === "profile") return (
    <ProfileScreen onBack={() => setScreen("menu")} onAuth={() => setScreen("auth")} />
  );

  if (screen === "lobby") return (
    <LobbyScreen
      onBack={() => { setLobbyResume(null); setScreen("menu"); }}
      onAuth={() => setScreen("auth")}
      resume={lobbyResume}
      // Host start hands every client the live match.
      onStart={(info) => { setLobbyResume(null); setMatch(info); setScreen("match"); }}
    />
  );

  if (screen === "match" && match) return (
    <MatchScreen sessionId={match.sessionId} seat={match.seat} code={match.code}
      onExit={() => { setMatch(null); setScreen("menu"); }} />
  );

  if (screen === "settings") return <SettingsScreen onBack={() => setScreen("menu")} />;

  if (screen === "intro") return <IntroSequence onDone={() => setScreen("nation")} />;

  if (screen === "nation") return (
    <NationSelect onBack={() => setScreen("menu")} onConfirm={(id) => { game.chooseNation(id); setScreen("hub"); }} />
  );

  if (screen === "hub") return (
    <HubScreen
      onCampaign={() => setScreen("game")}
      onBarracks={() => setScreen("barracks")}
      onWorld={() => setScreen("world")}
      onTrade={() => setScreen("trade")}
      onHomeland={() => setScreen("homeland")}
      onDoctrine={() => setScreen("doctrine")}
      onHeroes={() => setScreen("heroes")}
      onMenu={() => setScreen("menu")}
    />
  );

  if (screen === "homeland") return <HomelandScreen onBack={() => setScreen("hub")} />;
  if (screen === "doctrine") return <DoctrineScreen onBack={() => setScreen("hub")} />;
  if (screen === "heroes") return <HeroesScreen onBack={() => setScreen("hub")} />;

  if (screen === "barracks") return <Barracks onBack={() => setScreen("hub")} />;

  if (screen === "trade") return <TradeScreen onBack={() => setScreen("hub")} />;

  if (screen === "world") return (
    <WorldMap onBack={() => setScreen("hub")} onArmy={() => setScreen("barracks")} />
  );

  // "game" = Operations: missions, bot skirmish, and online (scaffold)
  return <OperationsScreen onBack={() => setScreen("hub")} onWorld={() => setScreen("world")} onBarracks={() => setScreen("barracks")} />;
}