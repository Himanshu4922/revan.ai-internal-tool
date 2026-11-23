"use client";

import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Field,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { APIKey, ProjectEnv, ProjectWithMembers } from "@/lib/api";
import { PROVIDER_VALUES, providerGroups } from "@/lib/providers";

const PROVIDER_GROUPS = providerGroups();
const OTHER_VALUE = "__other__";

export type KeyFormValues = {
  provider: string;
  label: string;
  project_id: string;
  project_env: ProjectEnv;
  secret: string;
  meta: string;
  notes: string;
};

const emptyForm = (projectId = ""): KeyFormValues => ({
  provider: "openai",
  label: "",
  project_id: projectId,
  project_env: "prod",
  secret: "",
  meta: "",
  notes: "",
});

export function keyToForm(k: APIKey): KeyFormValues {
  return {
    provider: k.provider,
    label: k.label || "",
    project_id: k.project_id,
    project_env: k.project_env,
    secret: "",
    meta: k.meta ? JSON.stringify(k.meta, null, 2) : "",
    notes: k.notes || "",
  };
}

export function KeyDialog({
  open,
  onOpenChange,
  projects,
  initial,
  mode = "create",
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: ProjectWithMembers[];
  initial?: KeyFormValues;
  mode?: "create" | "edit";
  onSubmit: (values: KeyFormValues) => Promise<void>;
}) {
  const [form, setForm] = useState<KeyFormValues>(emptyForm());
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm(initial ?? emptyForm(projects[0]?.id || ""));
    setError("");
    setPending(false);
    // Seed once when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.project_id) {
      setError("Select a project.");
      return;
    }
    if (!form.provider.trim()) {
      setError("Select or enter a provider.");
      return;
    }
    if (mode === "create" && !form.secret.trim()) {
      setError("Secret is required for new keys.");
      return;
    }
    if (form.meta.trim()) {
      try {
        JSON.parse(form.meta);
      } catch {
        setError("Meta must be valid JSON.");
        return;
      }
    }
    setPending(true);
    setError("");
    try {
      await onSubmit(form);
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setPending(false);
    }
  }

  const providerSelect = PROVIDER_VALUES.includes(form.provider)
    ? form.provider
    : OTHER_VALUE;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-col gap-4 overflow-hidden">
          <DialogHeader>
            <DialogTitle>{mode === "edit" ? "Update key" : "Connect provider"}</DialogTitle>
            <DialogDescription>
              Secrets are stored encrypted. Only a short hint is shown after save.
            </DialogDescription>
          </DialogHeader>

          <div className="grid max-h-[min(60vh,28rem)] gap-3 overflow-y-auto pr-1 sm:grid-cols-2">
            <Field label="Provider" htmlFor="key-provider">
              <Select
                id="key-provider"
                value={providerSelect}
                onChange={(e) => {
                  const v = e.target.value;
                  setForm({ ...form, provider: v === OTHER_VALUE ? "" : v });
                }}
              >
                {PROVIDER_GROUPS.map((g) => (
                  <optgroup key={g.group} label={g.group}>
                    {g.options.map((p) => (
                      <option key={p.value} value={p.value}>
                        {p.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
                <option value={OTHER_VALUE}>Other (custom)…</option>
              </Select>
            </Field>
            <Field label="Label" htmlFor="key-label">
              <Input
                id="key-label"
                value={form.label}
                onChange={(e) => setForm({ ...form, label: e.target.value })}
                placeholder="Optional"
              />
            </Field>
            {!PROVIDER_VALUES.includes(form.provider) ? (
              <Field label="Custom provider id" htmlFor="key-provider-custom" className="sm:col-span-2">
                <Input
                  id="key-provider-custom"
                  value={form.provider}
                  onChange={(e) => setForm({ ...form, provider: e.target.value })}
                  placeholder="e.g. my-vendor"
                  required
                />
              </Field>
            ) : null}
            <Field label="Project" htmlFor="key-project">
              <Select
                id="key-project"
                value={form.project_id}
                onChange={(e) => setForm({ ...form, project_id: e.target.value })}
                required
              >
                <option value="">Select…</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Env" htmlFor="key-env">
              <Select
                id="key-env"
                value={form.project_env}
                onChange={(e) =>
                  setForm({ ...form, project_env: e.target.value as ProjectEnv })
                }
              >
                <option value="prod">prod</option>
                <option value="staging">staging</option>
                <option value="testing">testing</option>
                <option value="other">other</option>
              </Select>
            </Field>
            <Field
              label={mode === "edit" ? "Secret (leave blank to keep)" : "Secret"}
              htmlFor="key-secret"
              className="sm:col-span-2"
            >
              <Input
                id="key-secret"
                type="password"
                value={form.secret}
                onChange={(e) => setForm({ ...form, secret: e.target.value })}
                autoComplete="off"
                required={mode === "create"}
              />
            </Field>
            <Field label="Meta JSON" htmlFor="key-meta" className="sm:col-span-2">
              <Textarea
                id="key-meta"
                rows={3}
                value={form.meta}
                onChange={(e) => setForm({ ...form, meta: e.target.value })}
                placeholder='{"account_sid":"AC..."}'
              />
            </Field>
            <Field label="Notes" htmlFor="key-notes" className="sm:col-span-2">
              <Textarea
                id="key-notes"
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </Field>
            {error ? (
              <p role="alert" className="text-sm text-[var(--error)] sm:col-span-2">
                {error}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || projects.length === 0}>
              {pending ? "Saving…" : mode === "edit" ? "Save changes" : "Add key"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
