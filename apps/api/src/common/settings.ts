import { getDb, appSettings } from "@smartbin/db";
import { config } from "./config/config.js";

// Every admin-editable setting. .env values are only the defaults used until an admin saves one.
export const SETTING_DEFINITIONS = {
  quotaLimitRegistrations: {
    label: "Bin registrations per user per month",
    min: 0,
    max: 100,
    default: () => config.QUOTA_LIMIT_REGISTRATIONS,
  },
  quotaLimitMissingReports: {
    label: "Missing reports per user per month",
    min: 0,
    max: 100,
    default: () => config.QUOTA_LIMIT_MISSING_REPORTS,
  },
  missingReportsThreshold: {
    label: "Missing reports needed to remove a bin",
    min: 1,
    max: 20,
    default: () => config.MISSING_REPORTS_THRESHOLD,
  },
} as const;

export type SettingKey = keyof typeof SETTING_DEFINITIONS;
export type Settings = Record<SettingKey, number>;

export const SETTING_KEYS = Object.keys(SETTING_DEFINITIONS) as SettingKey[];

// Settings are read on every register/report, so keep them in memory briefly.
// Saving clears this instance's copy immediately; other instances catch up within the TTL.
const CACHE_TTL_MS = 30_000;
let cache: { settings: Settings; expiresAt: number } | undefined;

function isValid(key: SettingKey, value: unknown): value is number {
  const def = SETTING_DEFINITIONS[key];
  return typeof value === "number" && Number.isInteger(value) && value >= def.min && value <= def.max;
}

export function defaultSettings(): Settings {
  return Object.fromEntries(SETTING_KEYS.map((k) => [k, SETTING_DEFINITIONS[k].default()])) as Settings;
}

export async function getSettings(): Promise<Settings> {
  if (cache && cache.expiresAt > Date.now()) {
    return cache.settings;
  }

  const rows = await getDb().select().from(appSettings);
  const settings = defaultSettings();
  for (const row of rows) {
    const key = row.key as SettingKey;
    // Ignore unknown keys and bad stored values rather than break registrations
    if (key in SETTING_DEFINITIONS && isValid(key, row.value)) {
      settings[key] = row.value;
    }
  }

  cache = { settings, expiresAt: Date.now() + CACHE_TTL_MS };
  return settings;
}

export function clearSettingsCache(): void {
  cache = undefined;
}
