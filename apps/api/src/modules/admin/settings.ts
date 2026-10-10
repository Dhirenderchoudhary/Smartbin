import { getDb, appSettings, settingChanges, users, eq, desc, getTableColumns } from "@smartbin/db";
import {
  SETTING_DEFINITIONS,
  SETTING_KEYS,
  clearSettingsCache,
  defaultSettings,
  getSettings,
  type SettingKey,
} from "../../common/settings.js";
import type { SettingsBody } from "./schemas.js";

const HISTORY_LIMIT = 20;

// Everything the admin Settings page needs: current values, defaults, ranges, who last changed each, recent history
export async function getAdminSettings() {
  const db = getDb();
  clearSettingsCache(); // admins should always see the stored values, not a cached copy

  const [values, rows, history] = await Promise.all([
    getSettings(),
    db
      .select({ key: appSettings.key, updatedAt: appSettings.updatedAt, updatedByEmail: users.email })
      .from(appSettings)
      .leftJoin(users, eq(appSettings.updatedBy, users.id)),
    db
      .select({ ...getTableColumns(settingChanges), changedByEmail: users.email })
      .from(settingChanges)
      .leftJoin(users, eq(settingChanges.changedBy, users.id))
      .orderBy(desc(settingChanges.changedAt))
      .limit(HISTORY_LIMIT),
  ]);

  const defaults = defaultSettings();
  const lastChange = new Map(rows.map((r) => [r.key, r]));

  return {
    settings: SETTING_KEYS.map((key) => {
      const def = SETTING_DEFINITIONS[key];
      const changed = lastChange.get(key);
      return {
        key,
        label: def.label,
        value: values[key],
        default: defaults[key],
        min: def.min,
        max: def.max,
        isDefault: !changed,
        updatedAt: changed?.updatedAt ?? null,
        updatedByEmail: changed?.updatedByEmail ?? null,
      };
    }),
    history,
  };
}

export async function updateAdminSettings(adminId: string, body: SettingsBody) {
  const db = getDb();
  const current = await getSettings();

  // Only write keys whose value actually changes, so history stays meaningful
  const changes = (Object.entries(body) as [SettingKey, number | undefined][]).filter(
    (entry): entry is [SettingKey, number] => entry[1] !== undefined && entry[1] !== current[entry[0]]
  );

  if (changes.length > 0) {
    await db.transaction(async (tx) => {
      for (const [key, value] of changes) {
        await tx
          .insert(appSettings)
          .values({ key, value, updatedBy: adminId })
          .onConflictDoUpdate({
            target: appSettings.key,
            set: { value, updatedBy: adminId, updatedAt: new Date() },
          });
        await tx.insert(settingChanges).values({ key, oldValue: current[key], newValue: value, changedBy: adminId });
      }
    });
    clearSettingsCache();
  }

  return { changed: changes.map(([key]) => key), ...(await getAdminSettings()) };
}
