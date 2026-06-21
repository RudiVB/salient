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
import { useGame } from "@/lib/store";
import { fmt } from "@/lib/catalog";
import { initGlobalSfx, playMusic, stopMusic, type MusicName } from "@/lib/audio";

type Tab = "campaign" | "collection" | "battle";

// which music track plays on each screen ("intro" is omitted — it runs its own ambience)
const SCREEN_MUSIC: Record<string, MusicName> = {
  menu: "menuMusic", settings: "menuMusic", nation: "nationMusic",
  hub: "hubMusic", trade: "hubMusic", game: "hubMusic", homeland: "hubMusic",
  barracks: "barracksMusic", world: "worldMusic", lobby: "menuMusic",
};

export default function Page() {
  const [screen, setScreen] = useState<"menu" | "intro" | "nation" | "hub" | "barracks" | "trade" | "world" | "game" | "settings" | "homeland" | "doctrine" | "heroes" | "lobby">("menu");
  const [tab, setTab] = useState<Tab>("campaign");
  const game = useGame();

  useEffect(() => { initGlobalSfx(); }, []);                 // hover/click on every button, game-wide
  useEffect(() => {
    if (screen === "intro") { stopMusic(); return; }         // intro plays its own ambience
    playMusic(SCREEN_MUSIC[screen] || "menuMusic");
  }, [screen]);

  const totalTroops = game.collection.reduce((s, u) => s + u.troops, 0);
  const active = game.collection.filter((u) => u.troops > 0).length;

  if (screen === "menu") return (
    <MainMenu hasSave={!!game.position} onContinue={() => setScreen(game.nation ? "hub" : "nation")} onNew={() => { game.reset(); setScreen("intro"); }} onMultiplayer={() => setScreen("lobby")} onSettings={() => setScreen("settings")} />
  );

  if (screen === "lobby") return (
    <LobbyScreen
      onBack={() => setScreen("menu")}
      // Lobby slice hand-off: once the host starts, drop into the hub.
      // (Full multiplayer world sync wires in next.)
      onStart={() => setScreen("hub")}
    />
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