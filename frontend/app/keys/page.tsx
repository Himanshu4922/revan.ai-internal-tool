"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Shell } from "@/components/Shell";
import { EmptyState, PageHeader, ProviderCell, RelativeTime } from "@/components/ui";
import { api, APIKey, CreditSnapshot, ProjectEnv, ProjectWithMembers } from "@/lib/api";
import { PROVIDER_VALUES, providerGroups } from "@/lib/providers";

const emptyForm = {
  provider: "openai",
  label: "",
  project_id: "",
  project_env: "prod" as ProjectEnv,
  secret: "",
  meta: "",
  notes: "",
};

const PROVIDER_GROUPS = providerGroups();
const OTHER_VALUE = "__other__";

export default function KeysPage() {
  const router = useRouter();
  const [keys, setKeys] = useState<APIKey[]>([]);
  const [projects, setProjects] = useState<ProjectWithMembers[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, CreditSnapshot | undefined>>({});
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const me = await api.me();
      if (me.role !== "admin") {
        router.replace("/dashboard");
        return;
      }
      const [keysRes, projRes, dash] = await Promise.all([
        api.listKeys(),
        api.listProjects(),
        api.dashboard(),
      ]);
      setKeys(keysRes.items || []);
      setProjects(projRes.items || []);
      const snap: Record<string, CreditSnapshot | undefined> = {};
      for (const pd of dash.projects || []) {
        for (const item of pd.items || []) {
          snap[item.key.id] = item.snapshot;
        }
      }
      setSnapshots(snap);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load keys");
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  function startEdit(k: APIKey) {
    setEditId(k.id);
    setForm({
      provider: k.provider,
      label: k.label || "",
      project_id: k.project_id,
      project_env: k.project_env,
      secret: "",
      meta: k.meta ? JSON.stringify(k.meta, null, 2) : "",
      notes: k.notes || "",
    });
    setShowForm(true);
    setMsg("");
  }

  function resetForm() {
    setEditId(null);
    setForm(emptyForm);
    setShowForm(false);
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setMsg("");
    if (!form.project_id) {
      setError("Create a project first, then assign this key to it");
      return;
    }
    let meta: Record<string, unknown> | undefined;
    if (form.meta.trim()) {
      try {
        meta = JSON.parse(form.meta);
      } catch {
        setError("Meta must be valid JSON");
        return;
      }
    }
    const body: Record<string, unknown> = {
      provider: form.provider.trim(),
      label: form.label.trim(),
      project_id: form.project_id,
      project_env: form.project_env,
      notes: form.notes,
      meta: meta || {},
    };
    try {
      if (editId) {
        if (form.secret.trim()) body.secret = form.secret.trim();
        await api.updateKey(editId, body);
        setMsg("Key updated");
      } else {
        if (!form.secret.trim()) {
          setError("Secret is required for new keys");
          return;
        }
        body.secret = form.secret.trim();
        await api.createKey(body);
        setMsg("Key created");
      }
      resetForm();
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  async function remove(id: string) {
    if (!confirm("Delete this key?")) return;
    try {
      await api.deleteKey(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function check(id: string) {
    try {
      await api.checkKey(id);
      setMsg("Check complete — see Dashboard");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check failed");
    }
  }

  async function copyHint(hint: string, id: string) {
    const text = `…${hint}`;
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setError("Could not copy to clipboard");
    }
  }

  return (
    <Shell>
      <PageHeader
        title="Encrypted credentials"
        description="Secrets are stored encrypted and never returned to the browser — only a short hint is shown."
        actions={
          <>
            <Link className="btn" href="/projects">
              Projects
            </Link>
            <button
              className="btn primary"
              type="button"
              onClick={() => {
                setEditId(null);
                setForm(emptyForm);
                setShowForm(true);
                setMsg("");
              }}
              disabled={projects.length === 0}
            >
              Connect provider
            </button>
          </>
        }
      />

      {error ? <div className="err">{error}</div> : null}
      {msg ? <p className="ok-msg">{msg}</p> : null}

      {projects.length === 0 ? (
        <EmptyState
          title="Create a project first"
          action={
            <Link className="btn primary" href="/projects">
              Go to Projects
            </Link>
          }
        >
          Keys must belong to a project and environment before they can be added.
        </EmptyState>
      ) : null}

      {showForm ? (
        <form className="card" onSubmit={onSubmit} style={{ marginBottom: "1.15rem" }}>
          <h2 className="card-title">{editId ? "Update key" : "Add key"}</h2>
          <p className="card-sub" style={{ marginBottom: "1rem" }}>
            Assign a provider secret to a project + env
          </p>
          <div className="form-grid">
            <div className="field">
              <label>Provider</label>
              <select
                value={PROVIDER_VALUES.includes(form.provider) ? form.provider : OTHER_VALUE}
                onChange={(e) => {
                  const v = e.target.value;
                  setForm({
                    ...form,
                    provider: v === OTHER_VALUE ? "" : v,
                  });
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
              </select>
              {!PROVIDER_VALUES.includes(form.provider) ? (
                <input
                  style={{ marginTop: "0.5rem" }}
                  placeholder="Custom provider id (e.g. my-vendor)"
                  value={form.provider}
                  onChange={(e) => setForm({ ...form, provider: e.target.value })}
                  required
                />
              ) : null}
            </div>
            <div className="field">
              <label>Label</label>
              <input value={form.label} onChange={(e) => setForm({ ...form, label: e.target.value })} />
            </div>
            <div className="field">
              <label>Project</label>
              <select
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
              </select>
            </div>
            <div className="field">
              <label>Env</label>
              <select
                value={form.project_env}
                onChange={(e) => setForm({ ...form, project_env: e.target.value as ProjectEnv })}
              >
                <option value="prod">prod</option>
                <option value="staging">staging</option>
                <option value="testing">testing</option>
                <option value="other">other</option>
              </select>
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>Secret {editId ? "(leave blank to keep)" : ""}</label>
              <input
                type="password"
                value={form.secret}
                onChange={(e) => setForm({ ...form, secret: e.target.value })}
                autoComplete="off"
                required={!editId}
              />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>Meta JSON (e.g. Twilio account_sid)</label>
              <textarea
                rows={3}
                value={form.meta}
                onChange={(e) => setForm({ ...form, meta: e.target.value })}
                placeholder='{"account_sid":"AC..."}'
              />
            </div>
            <div className="field" style={{ gridColumn: "1 / -1" }}>
              <label>Notes</label>
              <textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </div>
          </div>
          <div className="row-actions">
            <button className="btn primary" type="submit" disabled={projects.length === 0}>
              {editId ? "Save changes" : "Add key"}
            </button>
            <button className="btn" type="button" onClick={resetForm}>
              Cancel
            </button>
          </div>
        </form>
      ) : null}

      <div className="card table-wrap">
        {keys.length === 0 ? (
          <EmptyState title="No keys yet">
            Use Connect provider to add an encrypted credential.
          </EmptyState>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Provider</th>
                <th>Project</th>
                <th>Env</th>
                <th>Key hint</th>
                <th>Status</th>
                <th>Last sync</th>
                <th>Created</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {keys.map((k) => {
                const snap = snapshots[k.id];
                const status = snap?.status || "unknown";
                return (
                  <tr key={k.id}>
                    <td>
                      <ProviderCell provider={k.provider} subtitle={k.label || undefined} />
                    </td>
                    <td>{k.project_name}</td>
                    <td>
                      <span className="badge env">{k.project_env}</span>
                    </td>
                    <td>
                      <span className="hint-copy">
                        <span className="mono">…{k.key_hint}</span>
                        <button
                          className="btn sm ghost"
                          type="button"
                          onClick={() => copyHint(k.key_hint, k.id)}
                          aria-label="Copy key hint"
                        >
                          {copied === k.id ? "Copied" : "Copy"}
                        </button>
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${status}`}>{status}</span>
                    </td>
                    <td>
                      <RelativeTime iso={snap?.checked_at} />
                    </td>
                    <td>
                      <RelativeTime iso={k.created_at} />
                    </td>
                    <td>
                      <div className="row-actions">
                        <button className="btn sm" type="button" onClick={() => startEdit(k)}>
                          Edit
                        </button>
                        <button className="btn sm" type="button" onClick={() => check(k.id)}>
                          Check
                        </button>
                        <button className="btn sm danger" type="button" onClick={() => remove(k.id)}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </Shell>
  );
}
