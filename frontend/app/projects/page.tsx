"use client";

import { FormEvent, useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Shell } from "@/components/Shell";
import { api, ProjectMember, ProjectWithMembers, User } from "@/lib/api";

export default function ProjectsPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<ProjectWithMembers[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
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
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    }
  }

  function startEdit(p: ProjectWithMembers) {
    setEditId(p.id);
    setName(p.name);
    setDescription(p.description || "");
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
      <div className="toolbar">
        <div>
          <h1 style={{ margin: 0, fontSize: "1.25rem" }}>Projects</h1>
          <p className="muted" style={{ margin: "0.25rem 0 0" }}>
            Projects own envs/keys and have assigned team members (shown on alerts)
          </p>
        </div>
      </div>

      {error ? <div className="err">{error}</div> : null}
      {msg ? <p className="muted">{msg}</p> : null}

      {user?.role === "admin" ? (
        <>
          <form className="panel" onSubmit={saveProject} style={{ marginBottom: "1.25rem" }}>
            <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>
              {editId ? "Update project" : "Add project"}
            </h2>
            <div className="form-grid">
              <div className="field">
                <label>Name</label>
                <input value={name} onChange={(e) => setName(e.target.value)} required placeholder="e.g. Agni Calling" />
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
              {editId ? (
                <button
                  className="btn"
                  type="button"
                  onClick={() => {
                    setEditId(null);
                    setName("");
                    setDescription("");
                  }}
                >
                  Cancel
                </button>
              ) : null}
            </div>
          </form>

          <form className="panel" onSubmit={addMember} style={{ marginBottom: "1.25rem" }}>
            <h2 style={{ marginTop: 0, fontSize: "1.05rem" }}>Add team member</h2>
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
        </>
      ) : null}

      {items.map((p) => (
        <div key={p.id} className="panel" style={{ marginBottom: "1rem" }}>
          <div className="toolbar">
            <div>
              <h2 style={{ margin: 0, fontSize: "1.05rem" }}>{p.name}</h2>
              <p className="muted" style={{ margin: "0.25rem 0 0" }}>
                {p.description || "No description"}
              </p>
            </div>
            {user?.role === "admin" ? (
              <div className="row-actions">
                <button className="btn" type="button" onClick={() => startEdit(p)}>
                  Edit
                </button>
                <button className="btn" type="button" onClick={() => router.push(`/dashboard`)}>
                  View dashboard
                </button>
                <button className="btn danger" type="button" onClick={() => removeProject(p.id)}>
                  Delete
                </button>
              </div>
            ) : null}
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
                          <button className="btn danger" type="button" onClick={() => removeMember(p.id, m)}>
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
    </Shell>
  );
}
