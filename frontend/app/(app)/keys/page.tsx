"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { EmptyState, ProviderCell, RelativeTime } from "@/components/widgets";
import { AdminSheet, DataSheet } from "@/components/DataSheet";
import { SheetSearch } from "@/components/SheetSearch";
import { Button } from "@/components/ui/button";
import { KeyDialog, keyToForm, type KeyFormValues } from "@/components/dialogs/KeyDialog";
import { api, APIKey, CreditSnapshot, ProjectWithMembers } from "@/lib/api";
import { TablePageSkeleton } from "@/components/Skeleton";

export default function KeysPage() {
  const router = useRouter();
  const [keys, setKeys] = useState<APIKey[]>([]);
  const [projects, setProjects] = useState<ProjectWithMembers[]>([]);
  const [snapshots, setSnapshots] = useState<Record<string, CreditSnapshot | undefined>>({});
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editKey, setEditKey] = useState<APIKey | null>(null);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [copied, setCopied] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  function openCreate() {
    setEditKey(null);
    setDialogOpen(true);
    setMsg("");
  }

  function openEdit(k: APIKey) {
    setEditKey(k);
    setDialogOpen(true);
    setMsg("");
  }

  async function saveKey(form: KeyFormValues) {
    let meta: Record<string, unknown> = {};
    if (form.meta.trim()) {
      meta = JSON.parse(form.meta) as Record<string, unknown>;
    }
    const body: Record<string, unknown> = {
      provider: form.provider.trim(),
      label: form.label.trim(),
      project_id: form.project_id,
      project_env: form.project_env,
      notes: form.notes,
      meta,
    };
    if (editKey) {
      if (form.secret.trim()) body.secret = form.secret.trim();
      await api.updateKey(editKey.id, body);
      setMsg("Key updated");
    } else {
      body.secret = form.secret.trim();
      await api.createKey(body);
      setMsg("Key created");
    }
    await load();
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
    try {
      await navigator.clipboard.writeText(`…${hint}`);
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      setError("Could not copy to clipboard");
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return keys;
    return keys.filter((k) => {
      const snap = snapshots[k.id];
      return `${k.provider} ${k.label || ""} ${k.project_name || ""} ${k.project_env} ${k.key_hint} ${snap?.status || ""}`
        .toLowerCase()
        .includes(q);
    });
  }, [keys, search, snapshots]);

  const countLabel =
    filtered.length === keys.length ? String(keys.length) : `${filtered.length} of ${keys.length}`;

  if (loading) return <TablePageSkeleton title="API Keys" />;

  return (
    <AdminSheet>
      <DataSheet
        title="API Keys"
        count={countLabel}
        toolbar={
          <>
            <SheetSearch
              value={search}
              onChange={setSearch}
              placeholder="Search keys"
              aria-label="Search keys"
            />
            <Button variant="outline" size="sm" asChild>
              <Link href="/projects">Projects</Link>
            </Button>
            <Button size="sm" onClick={openCreate} disabled={projects.length === 0}>
              Connect provider
            </Button>
          </>
        }
      >
        {error ? <div className="err" style={{ margin: "0.75rem" }}>{error}</div> : null}
        {msg ? <p className="ok-msg" style={{ margin: "0.75rem" }}>{msg}</p> : null}

        {projects.length === 0 ? (
          <EmptyState
            title="Create a project first"
            action={
              <Button asChild>
                <Link href="/projects">Go to Projects</Link>
              </Button>
            }
          >
            Keys must belong to a project and environment before they can be added.
          </EmptyState>
        ) : null}

        {keys.length === 0 && projects.length > 0 ? (
          <EmptyState
            title="No keys yet"
            action={<Button onClick={openCreate}>Connect provider</Button>}
          >
            Use Connect provider to add an encrypted credential.
          </EmptyState>
        ) : keys.length > 0 && filtered.length === 0 ? (
          <div className="px-4 py-16 text-center text-[13px] text-[var(--muted)]">
            No keys match this search.
          </div>
        ) : filtered.length > 0 ? (
          <table className="sheet-table">
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
              {filtered.map((k) => {
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
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => copyHint(k.key_hint, k.id)}
                          aria-label="Copy key hint"
                        >
                          {copied === k.id ? "Copied" : "Copy"}
                        </Button>
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
                        <Button size="sm" variant="outline" onClick={() => openEdit(k)}>
                          Edit
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => check(k.id)}>
                          Check
                        </Button>
                        <Button size="sm" variant="destructive" onClick={() => remove(k.id)}>
                          Delete
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : null}
      </DataSheet>

      <KeyDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        projects={projects}
        mode={editKey ? "edit" : "create"}
        initial={editKey ? keyToForm(editKey) : undefined}
        onSubmit={saveKey}
      />
    </AdminSheet>
  );
}
