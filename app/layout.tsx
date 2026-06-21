import type { Metadata } from "next";
import "./globals.css";
import { GameProvider } from "@/lib/store";
import CloudSync from "@/components/CloudSync";

export const metadata: Metadata = {
  title: "Salient — 1916",
  description: "A living-world WW1 strategy game: build your homeland, raise an army, and conquer a map that fights back in real time.",
  themeColor: "#070b12",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body><GameProvider>{children}<CloudSync /></GameProvider></body>
    </html>
  );
}