// Light / dark / system theme. The saved choice lives in localStorage; the resolved
// theme is <html data-theme="light|dark">, which globals.css styles.

export type ThemeChoice = "light" | "dark" | "system";

const KEY = "smartbin.theme";
const EVENT = "smartbin:themechange";

// Runs inline in <head> before first paint (no flash), and keeps "system" in sync with the device
export const themeScript = `(() => {
  const media = matchMedia("(prefers-color-scheme: dark)");
  const apply = () => {
    let choice = "system";
    try { choice = localStorage.getItem("${KEY}") || "system"; } catch {}
    const dark = choice === "dark" || (choice === "system" && media.matches);
    // Switch in one step: pause transitions so buttons don't fade one by one
    const pause = document.createElement("style");
    pause.textContent = "*,*::before,*::after{transition:none!important}";
    document.head.appendChild(pause);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    getComputedStyle(document.documentElement).color;
    setTimeout(() => pause.remove());
    document.querySelectorAll('meta[name="theme-color"]').forEach((m) => (m.content = dark ? "#000000" : "#ffffff"));
    window.dispatchEvent(new Event("${EVENT}"));
  };
  apply();
  document.addEventListener("DOMContentLoaded", apply); // browser-bar colour tags are parsed after this script
  media.addEventListener("change", apply);
  window.__applyTheme = apply;
})();`;

export function getThemeChoice(): ThemeChoice {
  try {
    return (localStorage.getItem(KEY) as ThemeChoice) || "system";
  } catch {
    return "system";
  }
}

export function setThemeChoice(choice: ThemeChoice): void {
  try {
    if (choice === "system") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, choice);
    (window as unknown as { __applyTheme?: () => void }).__applyTheme?.();
  } catch {
    // Storage blocked: apply for this page view only
    const dark = choice === "dark" || (choice === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    window.dispatchEvent(new Event(EVENT));
  }
}

export function isDark(): boolean {
  return document.documentElement.dataset.theme === "dark";
}

export function onThemeChange(callback: () => void): () => void {
  window.addEventListener(EVENT, callback);
  return () => window.removeEventListener(EVENT, callback);
}
