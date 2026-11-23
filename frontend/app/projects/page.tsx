"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Shell } from "@/components/Shell";
import { EmptyState, PageHeader } from "@/components/ui";
import { api, ProjectMember, ProjectWithMembers, User } from "@/lib/api";

export default function ProjectsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<ProjectWithMembers[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [showProjectForm, setShowProjectForm] = useState(false);
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
    if (!memberForm.projectId || !memberForm.name.trim()) return;
    try {
      await api.addMember(memberForm.projectId, {
        name: memberForm.name.trim(),
        email: memberForm.email.trim(),
        phone: memberForm.phone.trim(),
        role_label: memberForm.role_label.trim(),
      });
      setMemberForm({ projectId: memberForm.projectId, name: "", email: "", phone: "", role_label: "" });
      setMsg("Team member added");
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

  return (
    <Shell>
      <PageHeader
        title="Projects"
        description="Organize keys by project, assign a team, and attribute credit alerts."
        actions={
          user?.role === "admin" ? (
            <button
              className="btn primary"
              type="button"
              onClick={() => {
                setEditId(null);
                setName("");
                setDescription("");
                setShowProjectForm(true);
              }}
            >
              New project
            </button>
          ) : null
        }
      />

      {error ? <div className="err">{error}</div> : null}
      {msg ? <p className="ok-msg">{msg}</p> : null}

      {user?.role === "admin" && showProjectForm ? (
        <form className="card" onSubmit={saveProject} style={{ marginBottom: "1.15rem" }}>
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

      {user?.role === "admin" && items.length > 0 ? (
        <form className="card" onSubmit={addMember} style={{ marginBottom: "1.15rem" }}>
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
          <button className="btn primary" type="submit">
            Add member
          </button>
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
        <div className="stack">
          {items.map((p) => (
            <div key={p.id} className="card">
              <div className="toolbar">
                <div>
                  <h2 className="card-title">{p.name}</h2>
                  <p className="card-sub">{p.description || "No description"}</p>
                </div>
                <div className="row-actions">
                  <Link className="btn sm" href="/dashboard">
                    View dashboard
                  </Link>
                  {user?.role === "admin" ? (
                    <>
                      <button className="btn sm" type="button" onClick={() => startEdit(p)}>
                        Edit
                      </button>
                      <button className="btn sm danger" type="button" onClick={() => removeProject(p.id)}>
                        Delete
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
              <div className="table-wrap">
                <table>
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
                    {(p.members || []).length === 0 ? (
                      <tr>
                        <td colSpan={5} className="muted">
                          No team members yet.
                        </td>
                      </tr>
                    ) : (
                      (p.members || []).map((m) => (
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
              </div>
            </div>
          ))}
        </div>
      )}
    </Shell>
  );
}
