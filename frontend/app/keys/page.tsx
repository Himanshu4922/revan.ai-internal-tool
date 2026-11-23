"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "@/components/Shell";
import { api, APIKey, ProjectEnv, ProjectWithMembers } from "@/lib/api";

const emptyForm = {
  provider: "openai",
  label: "",
  project_id: "",
  project_env: "prod" as ProjectEnv,
  secret: "",
  meta: "",
  notes: "",
};

export default function KeysPage() {
  const router = useRouter();
  const [keys, setKeys] = useState<APIKey[]>([]);
  const [projects, setProjects] = useState<ProjectWithMembers[]>([]);
  const [form, setForm] = useState(emptyForm);
  const [editId, setEditId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    try {
      const me = await api.me();
      if (me.role !== "admin") {
        router.replace("/dashboard");
        return;
      }
      const [keysRes, projRes] = await Promise.all([api.listKeys(), api.listProjects()]);
      setKeys(keysRes.items || []);
      setProjects(projRes.items || []);
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
    setMsg("");
  }

  function resetForm() {
    setEditId(null);
    setForm(emptyForm);
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
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check failed");
    }
  }

  return (
    <Shell>
      <div className="toolbar">
        <div>
          <h1 style={{ margin: 0, fontSize: "1.25rem" }}>API keys</h1>
          <p className="muted" style={{ margin: "0.25rem 0 0" }}>
            Each key belongs to a project + env (prod / staging / testing / other)
          </p>
        </div>
      </div>

      {error ? <div className="err">{error}</div> : null}
      {msg ? <p className="muted">{msg}</p> : null}

      {projects.length === 0 ? (
        <div className="panel muted" style={{ marginBottom: "1rem" }}>
          No projects yet. Create one on the <a href="/projects">Projects</a> page before adding keys.
        </div>
      ) : null}

      <form className="panel" onSubmit={onSubmit} style={{ marginBottom: "1.25rem" }}>
        <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>
          {editId ? "Update key" : "Add key"}
        </h2>
        <div className="form-grid">
          <div className="field">
            <label>Provider</label>
            <input
              list="providers"
              value={form.provider}
              onChange={(e) => setForm({ ...form, provider: e.target.value })}
              required
            />
            <datalist id="providers">
              {["openai", "anthropic", "twilio", "plivo", "telnyx", "stripe", "sendgrid", "gemini", "pinecone", "livekit", "soniox", "sarvam"].map(
                (p) => (
                  <option key={p} value={p} />
                )
              )}
            </datalist>
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
            <label>Env (under that project)</label>
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
            <textarea rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>
        <div className="row-actions">
          <button className="btn primary" type="submit" disabled={projects.length === 0}>
            {editId ? "Save changes" : "Add key"}
          </button>
          {editId ? (
            <button className="btn" type="button" onClick={resetForm}>
              Cancel
            </button>
          ) : null}
        </div>
      </form>

      <div className="panel table-wrap">
        <table>
          <thead>
            <tr>
              <th>Provider</th>
              <th>Project</th>
              <th>Env</th>
              <th>Hint</th>
              <th>Notes</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {keys.map((k) => (
              <tr key={k.id}>
                <td>
                  <div>{k.provider}</div>
                  <div className="muted">{k.label}</div>
                </td>
                <td>{k.project_name}</td>
                <td>{k.project_env}</td>
                <td className="mono">…{k.key_hint}</td>
                <td className="muted">{k.notes || "—"}</td>
                <td>
                  <div className="row-actions">
                    <button className="btn" type="button" onClick={() => startEdit(k)}>
                      Edit
                    </button>
                    <button className="btn" type="button" onClick={() => check(k.id)}>
                      Check
                    </button>
                    <button className="btn danger" type="button" onClick={() => remove(k.id)}>
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Shell>
  );
}
