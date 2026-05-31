"use client";

import { Moon, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

const themes = [
  { value: "light", label: "Light" },
  { value: "dark-graphite", label: "Graphite" },
  { value: "dark-midnight", label: "Midnight" },
  { value: "dark-neon", label: "Neon" }
] as const;

type ThemeName = (typeof themes)[number]["value"];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [theme, setTheme] = useState<ThemeName>("light");
  const [themeReady, setThemeReady] = useState(false);

  useEffect(() => {
    const savedTheme = window.localStorage.getItem("pokemon-market-theme") as ThemeName | null;
    if (savedTheme && themes.some((item) => item.value === savedTheme)) {
      setTheme(savedTheme);
    }
    setThemeReady(true);
  }, []);

  useEffect(() => {
    if (!themeReady) return;
    document.documentElement.dataset.theme = theme;
    window.localStorage.setItem("pokemon-market-theme", theme);
  }, [theme, themeReady]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void fetch("/api/market/captures/daily", { method: "POST" });
    }, 1200);
    return () => window.clearTimeout(timeout);
  }, []);

  return (
    <main className="shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Market dashboard</p>
          <h1>Pokemon Card Market Tracker</h1>
        </div>
        <div className="header-actions">
          <nav className="app-nav" aria-label="Primary navigation">
            <Link className={pathname === "/" ? "active" : ""} href="/">
              Dashboard
            </Link>
            <Link className={pathname === "/overview" ? "active" : ""} href="/overview">
              Market Overview
            </Link>
          </nav>
          <label className="theme-picker">
            <Moon size={18} />
            <select value={theme} onChange={(event) => setTheme(event.target.value as ThemeName)} aria-label="Theme">
              {themes.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <div className="mode-pill">
            <ShieldCheck size={18} />
            Mock-safe MVP
          </div>
        </div>
      </header>
      {children}
    </main>
  );
}
