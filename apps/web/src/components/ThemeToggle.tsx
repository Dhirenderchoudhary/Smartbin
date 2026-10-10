"use client";

import { MonitorIcon, MoonIcon, SunIcon } from "lucide-react";
import { useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { getThemeChoice, isDark, onThemeChange, setThemeChoice, type ThemeChoice } from "@/lib/theme";

// One-tap switch between light and dark (icons swap with CSS, so no flash on load)
export function ThemeToggle({ className }: { className?: string }) {
  return (
    <Button
      variant="ghost"
      size="icon-lg"
      className={className}
      aria-label="Switch between light and dark mode"
      onClick={() => setThemeChoice(isDark() ? "light" : "dark")}
    >
      <MoonIcon className="dark:hidden" />
      <SunIcon className="hidden dark:block" />
    </Button>
  );
}

// Light / Dark / System chips, for settings screens
export function ThemeChooser() {
  const choice = useSyncExternalStore(onThemeChange, getThemeChoice, () => "system" as ThemeChoice);
  return (
    <ToggleGroup
      value={[choice]}
      onValueChange={(v) => v[0] && setThemeChoice(v[0] as ThemeChoice)}
      variant="chip"
      size="chip"
      className="flex-wrap"
      aria-label="Appearance"
    >
      <ToggleGroupItem value="light">
        <SunIcon data-icon="inline-start" />
        Light
      </ToggleGroupItem>
      <ToggleGroupItem value="dark">
        <MoonIcon data-icon="inline-start" />
        Dark
      </ToggleGroupItem>
      <ToggleGroupItem value="system">
        <MonitorIcon data-icon="inline-start" />
        System
      </ToggleGroupItem>
    </ToggleGroup>
  );
}
