"use client";

import { CheckIcon } from "lucide-react";
import { useState } from "react";
import { AdminPage } from "@/components/admin/AdminShell";
import { ErrorNote, Loading, Panel } from "@/components/admin/parts";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/lib/api";
import { useAdminData, type SettingsData } from "@/lib/admin";
import { timeAgo } from "@/lib/bins";

function SettingsForm({ data, onSaved }: { data: SettingsData; onSaved: () => void }) {
  const [values, setValues] = useState<Record<string, string>>(() => Object.fromEntries(data.settings.map((s) => [s.key, String(s.value)])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const changes = Object.fromEntries(
    data.settings.filter((s) => values[s.key] !== "" && Number(values[s.key]) !== s.value).map((s) => [s.key, Number(values[s.key])])
  );
  const invalid = data.settings.some((s) => {
    const v = Number(values[s.key]);
    return values[s.key] === "" || !Number.isInteger(v) || v < s.min || v > s.max;
  });

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(undefined);
    try {
      await api("/admin/settings", { method: "PUT", body: changes });
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the settings.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={save}>
      <FieldGroup>
        {data.settings.map((s) => (
          <Field key={s.key}>
            <FieldLabel htmlFor={s.key}>{s.label}</FieldLabel>
            <Input
              id={s.key}
              type="number"
              inputMode="numeric"
              min={s.min}
              max={s.max}
              step={1}
              required
              value={values[s.key]}
              onChange={(e) => setValues((v) => ({ ...v, [s.key]: e.target.value }))}
              className="max-w-40"
            />
            <FieldDescription>
              {s.min} to {s.max}. Default {s.default}.
              {!s.isDefault && s.updatedAt && ` Last changed ${timeAgo(s.updatedAt)}${s.updatedByEmail ? ` by ${s.updatedByEmail}` : ""}.`}
            </FieldDescription>
          </Field>
        ))}
        <ErrorNote error={error} />
        <Button type="submit" size="lg" className="self-start" disabled={busy || invalid || !Object.keys(changes).length}>
          {busy && <Spinner data-icon="inline-start" />}
          Save changes
        </Button>
      </FieldGroup>
    </form>
  );
}

export default function SettingsPage() {
  const settings = useAdminData<SettingsData>("/admin/settings");
  // Lives here: the form remounts with the saved values, which would clear its own message
  const [saved, setSaved] = useState(false);
  const data = settings.data;
  const label = (key: string) => data?.settings.find((s) => s.key === key)?.label ?? key;

  return (
    <AdminPage title="Settings" description="Limits and rules for everyone using SmartBin. Changes apply immediately.">
      <ErrorNote error={settings.error} />
      {!data ? (
        <Loading className="h-96" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Panel title="Rules">
            {saved && (
              <p role="status" className="flex items-center gap-2 font-medium text-wet">
                <CheckIcon className="size-4" aria-hidden="true" /> Saved. It applies to everyone straight away.
              </p>
            )}
            <SettingsForm
              key={data.settings.map((s) => s.value).join("-")}
              data={data}
              onSaved={() => {
                setSaved(true);
                settings.reload();
              }}
            />
          </Panel>
          <Panel title="Recent changes">
            {!data.history.length ? (
              <p className="text-sm text-muted-foreground">Nothing has been changed yet.</p>
            ) : (
              <ol className="flex flex-col">
                {data.history.map((h) => (
                  <li key={h.id} className="flex flex-col gap-0.5 border-t py-2.5 first:border-0">
                    <span className="font-medium">
                      {label(h.key)}: {h.oldValue ?? "default"} → {h.newValue}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {h.changedByEmail ?? "An admin"}, {timeAgo(h.changedAt)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </Panel>
        </div>
      )}
    </AdminPage>
  );
}
