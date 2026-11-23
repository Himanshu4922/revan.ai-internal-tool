"use client";

import { FormEvent, Fragment, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/ui";
import { AdminSheet, DataSheet } from "@/components/DataSheet";
import { api, ProjectMember, ProjectWithMembers, User } from "@/lib/api";
import { TablePageSkeleton } from "@/components/Skeleton";

export default function ProjectsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<ProjectWithMembers[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [showProjectForm, setShowProjectForm] = useState(false);
  const [showMemberForm, setShowMemberForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [memberForm, setMemberForm] = useState({
    projectId: "",
    name: "",
    email: "",
    phone: "",
    role_label: "",
  });

  const load = useCallback(async () => {
    try {
      const me = await api.me();
      setUser(me);
      const res = await api.listProjects();
      setItems(res.items || []);
      setError("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function saveProject(e: FormEvent) {
    e.preventDefault();
    if (user?.role !== "admin") return;
    setError("");
    try {
      if (editId) {
        await api.updateProject(editId, { name: name.trim(), description });
        setMsg("Project updated");
      } else {
        await api.createProject({ name: name.trim(), description });
        setMsg("Project created");
      }
      setName("");
      setDescription("");
      setEditId(null);
      setShowProjectForm(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  function startEdit(p: ProjectWithMembers) {
    setEditId(p.id);
    setName(p.name);
    setDescription(p.description || "");
    setShowProjectForm(true);
    setMsg("");
  }

  async function removeProject(id: string) {
    if (!confirm("Delete this project? (Only works if it has no keys)")) return;
    try {
      await api.deleteProject(id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    }
  }

  async function addMember(e: FormEvent) {
    e.preventDefault();
    if (user?.role !== "admin") return;
    try {
      await api.addMember(memberForm.projectId, {
        name: memberForm.name.trim(),
        email: memberForm.email.trim(),
        phone: memberForm.phone.trim(),
        role_label: memberForm.role_label.trim(),
      });
      setMemberForm({ projectId: "", name: "", email: "", phone: "", role_label: "" });
      setShowMemberForm(false);
      setMsg("Member added");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Add member failed");
    }
  }

  async function removeMember(projectId: string, member: ProjectMember) {
    if (!confirm(`Remove ${member.name}?`)) return;
    try {
      await api.deleteMember(projectId, member.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed");
    }
  }

  if (loading) return <TablePageSkeleton title="Projects" />;

  return (
    <AdminSheet>
      <DataSheet
        title="Projects"
        toolbar={
          user?.role === "admin" ? (
            <>
              <button
                className="btn"
                type="button"
                onClick={() => {
                  setShowMemberForm((v) => !v);
                  setShowProjectForm(false);
                }}
                disabled={items.length === 0}
              >
                Add member
              </button>
              <button
                className="btn primary"
                type="button"
                onClick={() => {
                  setEditId(null);
                  setName("");
                  setDescription("");
                  setShowProjectForm(true);
                  setShowMemberForm(false);
                }}
              >
                New project
              </button>
            </>
          ) : null
        }
      >
        {error ? <div className="err" style={{ margin: "0.75rem" }}>{error}</div> : null}
        {msg ? <p className="ok-msg" style={{ margin: "0.75rem" }}>{msg}</p> : null}

        {user?.role === "admin" && showProjectForm ? (
          <form className="sheet-panel" onSubmit={saveProject}>
            <h2 className="card-title">{editId ? "Update project" : "Add project"}</h2>
            <div className="form-grid" style={{ marginTop: "0.85rem" }}>
              <div className="field">
                <label>Name</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="e.g. Agni Calling"
                />
              </div>
              <div className="field">
                <label>Description</label>
                <input value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
            </div>
            <div className="row-actions">
              <button className="btn primary" type="submit">
                {editId ? "Save" : "Create"}
              </button>
              <button
                className="btn"
                type="button"
                onClick={() => {
                  setEditId(null);
                  setName("");
                  setDescription("");
                  setShowProjectForm(false);
                }}
              >
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        {user?.role === "admin" && showMemberForm ? (
          <form className="sheet-panel" onSubmit={addMember}>
            <h2 className="card-title">Add team member</h2>
            <p className="card-sub" style={{ marginBottom: "0.85rem" }}>
              Shown on low-credit alerts for the project
            </p>
            <div className="form-grid">
              <div className="field">
                <label>Project</label>
                <select
                  value={memberForm.projectId}
                  onChange={(e) => setMemberForm({ ...memberForm, projectId: e.target.value })}
                  required
                >
                  <option value="">Select…</option>
                  {items.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Name</label>
                <input
                  value={memberForm.name}
                  onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })}
                  required
                />
              </div>
              <div className="field">
                <label>Email</label>
                <input
                  type="email"
                  value={memberForm.email}
                  onChange={(e) => setMemberForm({ ...memberForm, email: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Phone</label>
                <input
                  value={memberForm.phone}
                  onChange={(e) => setMemberForm({ ...memberForm, phone: e.target.value })}
                />
              </div>
              <div className="field">
                <label>Role on team</label>
                <input
                  value={memberForm.role_label}
                  onChange={(e) => setMemberForm({ ...memberForm, role_label: e.target.value })}
                  placeholder="e.g. owner, on-call"
                />
              </div>
            </div>
            <div className="row-actions">
              <button className="btn primary" type="submit">
                Add member
              </button>
              <button className="btn" type="button" onClick={() => setShowMemberForm(false)}>
                Cancel
              </button>
            </div>
          </form>
        ) : null}

        {items.length === 0 ? (
          <EmptyState
            title="No projects yet"
            action={
              user?.role === "admin" ? (
                <button
                  className="btn primary"
                  type="button"
                  onClick={() => setShowProjectForm(true)}
                >
                  Create project
                </button>
              ) : null
            }
          >
            Projects group API keys by product or environment ownership.
          </EmptyState>
        ) : (
          <table className="sheet-table">
            <thead>
              <tr>
                <th>Project</th>
                <th>Members</th>
                <th>Team</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {items.map((p) => {
                const members = p.members || [];
                const open = expanded === p.id;
                return (
                  <Fragment key={p.id}>
                    <tr>
                      <td>
                        <div className="font-medium">{p.name}</div>
                        <div className="muted text-[12px]">{p.description || "No description"}</div>
                      </td>
                      <td className="mono">{members.length}</td>
                      <td>
                        <button
                          className="btn sm ghost"
                          type="button"
                          onClick={() => setExpanded(open ? null : p.id)}
                        >
                          {open ? "Hide" : "View"} team
                        </button>
                      </td>
                      <td>
                        <div className="row-actions">
                          <Link className="btn sm" href="/dashboard">
                            Dashboard
                          </Link>
                          {user?.role === "admin" ? (
                            <>
                              <button className="btn sm" type="button" onClick={() => startEdit(p)}>
                                Edit
                              </button>
                              <button
                                className="btn sm danger"
                                type="button"
                                onClick={() => removeProject(p.id)}
                              >
                                Delete
                              </button>
                            </>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                    {open ? (
                      <tr>
                        <td colSpan={4} style={{ padding: 0, background: "var(--surface)" }}>
                          <table className="sheet-table">
                            <thead>
                              <tr>
                                <th>Team member</th>
                                <th>Role</th>
                                <th>Email</th>
                                <th>Phone</th>
                                <th />
                              </tr>
                            </thead>
                            <tbody>
                              {members.length === 0 ? (
                                <tr>
                                  <td colSpan={5} className="muted">
                                    No team members yet.
                                  </td>
                                </tr>
                              ) : (
                                members.map((m) => (
                                  <tr key={m.id}>
                                    <td>{m.name}</td>
                                    <td className="muted">{m.role_label || "—"}</td>
                                    <td className="muted">{m.email || "—"}</td>
                                    <td className="muted">{m.phone || "—"}</td>
                                    <td>
                                      {user?.role === "admin" ? (
                                        <button
                                          className="btn sm danger"
                                          type="button"
                                          onClick={() => removeMember(p.id, m)}
                                        >
                                          Remove
                                        </button>
                                      ) : null}
                                    </td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        )}
      </DataSheet>
    </AdminSheet>
  );
}
