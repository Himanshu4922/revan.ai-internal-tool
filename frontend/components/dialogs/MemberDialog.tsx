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

export type MemberFormValues = {
  projectId: string;
  name: string;
  email: string;
  phone: string;
  role_label: string;
};

export function MemberDialog({
  open,
  onOpenChange,
  projects,
  initialProjectId = "",
  onSubmit,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  projects: { id: string; name: string }[];
  initialProjectId?: string;
  onSubmit: (values: MemberFormValues) => Promise<void>;
}) {
  const [form, setForm] = useState<MemberFormValues>({
    projectId: "",
    name: "",
    email: "",
    phone: "",
    role_label: "",
  });
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) return;
    setForm({
      projectId: initialProjectId || projects[0]?.id || "",
      name: "",
      email: "",
      phone: "",
      role_label: "",
    });
    setError("");
    setPending(false);
    // Seed once when the dialog opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (!form.projectId) {
      setError("Select a project.");
      return;
    }
    if (!form.name.trim()) {
      setError("Enter a member name.");
      return;
    }
    setPending(true);
    setError("");
    try {
      await onSubmit({
        ...form,
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim(),
        role_label: form.role_label.trim(),
      });
      onOpenChange(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Add member failed");
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="flex min-h-0 flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Add team member</DialogTitle>
            <DialogDescription>
              Shown on low-credit alerts for the selected project.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-3">
            <Field label="Project" htmlFor="member-project">
              <Select
                id="member-project"
                value={form.projectId}
                onChange={(e) => setForm({ ...form, projectId: e.target.value })}
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
            <Field label="Name" htmlFor="member-name">
              <Input
                id="member-name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                autoFocus
              />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Email" htmlFor="member-email">
                <Input
                  id="member-email"
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                />
              </Field>
              <Field label="Phone" htmlFor="member-phone">
                <Input
                  id="member-phone"
                  value={form.phone}
                  onChange={(e) => setForm({ ...form, phone: e.target.value })}
                />
              </Field>
            </div>
            <Field label="Role on team" htmlFor="member-role">
              <Input
                id="member-role"
                value={form.role_label}
                onChange={(e) => setForm({ ...form, role_label: e.target.value })}
                placeholder="e.g. owner, on-call"
              />
            </Field>
            {error ? (
              <p role="alert" className="text-sm text-[var(--error)]">
                {error}
              </p>
            ) : null}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || projects.length === 0}>
              {pending ? "Adding…" : "Add member"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
