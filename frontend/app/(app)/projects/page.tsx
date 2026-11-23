"use client";

import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { EmptyState } from "@/components/widgets";
import { AdminSheet, DataSheet } from "@/components/DataSheet";
import { SheetSearch } from "@/components/SheetSearch";
import { Button } from "@/components/ui/button";
import { MemberDialog } from "@/components/dialogs/MemberDialog";
import { ProjectDialog } from "@/components/dialogs/ProjectDialog";
import { api, ProjectMember, ProjectWithMembers, User } from "@/lib/api";
import { TablePageSkeleton } from "@/components/Skeleton";

export default function ProjectsPage() {
  const [user, setUser] = useState<User | null>(null);
  const [items, setItems] = useState<ProjectWithMembers[]>([]);
  const [error, setError] = useState("");
  const [msg, setMsg] = useState("");
  const [search, setSearch] = useState("");
  const [projectOpen, setProjectOpen] = useState(false);
  const [memberOpen, setMemberOpen] = useState(false);
  const [editProject, setEditProject] = useState<ProjectWithMembers | null>(null);
  const [memberProjectId, setMemberProjectId] = useState("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

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

  function openCreateProject() {
    setEditProject(null);
    setProjectOpen(true);
    setMsg("");
  }

  function openEditProject(p: ProjectWithMembers) {
    setEditProject(p);
    setProjectOpen(true);
    setMsg("");
  }

  function openAddMember(projectId = "") {
    setMemberProjectId(projectId);
    setMemberOpen(true);
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

  async function removeMember(projectId: string, member: ProjectMember) {
    if (!confirm(`Remove ${member.name}?`)) return;
    try {
      await api.deleteMember(projectId, member.id);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Remove failed");
    }
  }

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter((p) => {
      const members = (p.members || [])
        .map((m) => `${m.name} ${m.email || ""} ${m.role_label || ""}`)
        .join(" ");
      return `${p.name} ${p.description || ""} ${members}`.toLowerCase().includes(q);
    });
  }, [items, search]);

  const countLabel =
    filtered.length === items.length
      ? String(items.length)
      : `${filtered.length} of ${items.length}`;

  if (loading) return <TablePageSkeleton title="Projects" />;

  return (
    <AdminSheet>
      <DataSheet
        title="Projects"
        count={countLabel}
        toolbar={
          <>
            <SheetSearch
              value={search}
              onChange={setSearch}
              placeholder="Search projects"
              aria-label="Search projects"
            />
            {user?.role === "admin" ? (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => openAddMember()}
                  disabled={items.length === 0}
                >
                  Add member
                </Button>
                <Button size="sm" onClick={openCreateProject}>
                  New project
                </Button>
              </>
            ) : null}
          </>
        }
      >
        {error ? <div className="err" style={{ margin: "0.75rem" }}>{error}</div> : null}
        {msg ? <p className="ok-msg" style={{ margin: "0.75rem" }}>{msg}</p> : null}

        {items.length === 0 ? (
          <EmptyState
            title="No projects yet"
            action={
              user?.role === "admin" ? (
                <Button onClick={openCreateProject}>Create project</Button>
              ) : null
            }
          >
            Projects group API keys by product or environment ownership.
          </EmptyState>
        ) : filtered.length === 0 ? (
          <div className="px-4 py-16 text-center text-[13px] text-[var(--muted)]">
            No projects match this search.
          </div>
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
              {filtered.map((p) => {
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
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpanded(open ? null : p.id)}
                        >
                          {open ? "Hide" : "View"} team
                        </Button>
                      </td>
                      <td>
                        <div className="row-actions">
                          <Link className="btn sm" href="/dashboard">
                            Dashboard
                          </Link>
                          {user?.role === "admin" ? (
                            <>
                              <Button size="sm" variant="outline" onClick={() => openAddMember(p.id)}>
                                Add member
                              </Button>
                              <Button size="sm" variant="outline" onClick={() => openEditProject(p)}>
                                Edit
                              </Button>
                              <Button
                                size="sm"
                                variant="destructive"
                                onClick={() => removeProject(p.id)}
                              >
                                Delete
                              </Button>
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
                                        <Button
                                          size="sm"
                                          variant="destructive"
                                          onClick={() => removeMember(p.id, m)}
                                        >
                                          Remove
                                        </Button>
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

      <ProjectDialog
        open={projectOpen}
        onOpenChange={setProjectOpen}
        mode={editProject ? "edit" : "create"}
        initial={
          editProject
            ? { name: editProject.name, description: editProject.description || "" }
            : undefined
        }
        onSubmit={async (values) => {
          if (editProject) {
            await api.updateProject(editProject.id, values);
            setMsg("Project updated");
          } else {
            await api.createProject(values);
            setMsg("Project created");
          }
          await load();
        }}
      />

      <MemberDialog
        open={memberOpen}
        onOpenChange={setMemberOpen}
        projects={items.map((p) => ({ id: p.id, name: p.name }))}
        initialProjectId={memberProjectId}
        onSubmit={async (values) => {
          await api.addMember(values.projectId, {
            name: values.name,
            email: values.email,
            phone: values.phone,
            role_label: values.role_label,
          });
          setMsg("Member added");
          await load();
        }}
      />
    </AdminSheet>
  );
}
