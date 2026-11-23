"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Search, X, LayoutDashboard, KeyRound, FolderKanban, Cable, ChartColumn, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { DialogOverlay, DialogPortal } from "@/components/ui/dialog";

type PageHit = {
  kind: "page";
  href: string;
  label: string;
  hint: string;
  icon: typeof LayoutDashboard;
};

type EntityHit = {
  kind: "project" | "key" | "provider";
  href: string;
  label: string;
  hint: string;
};

type Hit = PageHit | EntityHit;

const PAGES: PageHit[] = [
  { kind: "page", href: "/dashboard", label: "Dashboard", hint: "Overview & credit status", icon: LayoutDashboard },
  { kind: "page", href: "/providers", label: "Providers", hint: "Connected API providers", icon: Cable },
  { kind: "page", href: "/usage", label: "Usage", hint: "Spend & balance analytics", icon: ChartColumn },
  { kind: "page", href: "/keys", label: "API Keys", hint: "Encrypted credentials", icon: KeyRound },
  { kind: "page", href: "/projects", label: "Projects", hint: "Projects and team members", icon: FolderKanban },
  { kind: "page", href: "/settings", label: "Settings", hint: "Account & monitoring config", icon: Settings },
];

function ResultRow({
  onClick,
  children,
}: {
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-3 px-3 py-2 text-left outline-none transition-colors hover:bg-[var(--overlay)]"
    >
      {children}
    </button>
  );
}

export function SearchPalette() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [entityHits, setEntityHits] = useState<EntityHit[]>([]);
  const [pending, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  const close = useCallback(() => {
    setOpen(false);
    setQuery("");
    setEntityHits([]);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  const pageHits = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return PAGES;
    return PAGES.filter(
      (p) =>
        p.label.toLowerCase().includes(q) ||
        p.hint.toLowerCase().includes(q) ||
        p.href.includes(q)
    );
  }, [query]);

  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setEntityHits([]);
      return;
    }
    const tid = setTimeout(() => {
      startTransition(async () => {
        try {
          const [projects, keys, dash] = await Promise.all([
            api.listProjects().catch(() => ({ items: [] })),
            api.listKeys().catch(() => ({ items: [] })),
            api.dashboard().catch(() => ({ projects: [] })),
          ]);
          const needle = q.toLowerCase();
          const hits: EntityHit[] = [];

          for (const p of projects.items || []) {
            const blob = `${p.name} ${p.description || ""}`.toLowerCase();
            if (blob.includes(needle)) {
              hits.push({
                kind: "project",
                href: "/projects",
                label: p.name,
                hint: p.description || "Project",
              });
            }
          }

          for (const k of keys.items || []) {
            const blob = `${k.provider} ${k.label || ""} ${k.project_name || ""} ${k.key_hint || ""}`.toLowerCase();
            if (blob.includes(needle)) {
              hits.push({
                kind: "key",
                href: "/keys",
                label: k.label || k.provider,
                hint: `${k.provider} · ${k.project_name} · …${k.key_hint}`,
              });
            }
          }

          const providers = new Set<string>();
          for (const pd of dash.projects || []) {
            for (const item of pd.items || []) {
              const provider = item.key?.provider;
              if (!provider || providers.has(provider)) continue;
              if (provider.toLowerCase().includes(needle)) {
                providers.add(provider);
                hits.push({
                  kind: "provider",
                  href: "/providers",
                  label: provider,
                  hint: "Provider",
                });
              }
            }
          }

          setEntityHits(hits.slice(0, 24));
        } catch {
          setEntityHits([]);
        }
      });
    }, 200);
    return () => clearTimeout(tid);
  }, [query]);

  function go(href: string) {
    router.push(href);
    close();
  }

  const hasQuery = query.trim().length >= 2;
  const total = pageHits.length + entityHits.length;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "hidden h-9 w-[min(100%,240px)] shrink-0 cursor-text items-center gap-2.5 rounded-md border border-[var(--border)] bg-[var(--surface-2)] pl-3 pr-2.5 text-[var(--muted)] transition-colors hover:border-[var(--border-strong)] hover:text-[var(--text)] sm:flex"
        )}
      >
        <Search size={13} className="shrink-0" />
        <span className="flex-1 text-left text-[13px]">Search anything…</span>
        <kbd className="rounded border border-[var(--border)] px-1.5 text-[11px] text-[var(--muted)]">
          ⌘K
        </kbd>
      </button>

      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex size-8 items-center justify-center rounded-lg text-[var(--muted)] transition-colors hover:bg-[var(--overlay)] hover:text-[var(--text)] sm:hidden"
        aria-label="Open search"
      >
        <Search size={17} />
      </button>

      <DialogPrimitive.Root
        open={open}
        onOpenChange={(o) => {
          if (!o) close();
          else setOpen(true);
        }}
      >
        <DialogPortal>
          <DialogOverlay />
          <DialogPrimitive.Content
            onOpenAutoFocus={(e) => {
              e.preventDefault();
              inputRef.current?.focus();
            }}
            className={cn(
              "fixed top-[80px] left-1/2 z-50 w-[calc(100vw-32px)] max-w-[580px] -translate-x-1/2 overflow-hidden rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-lg outline-none"
            )}
          >
            <DialogPrimitive.Title className="sr-only">Search</DialogPrimitive.Title>
            <div className="flex items-center gap-2 border-b border-[var(--border)] px-3 py-2.5">
              <Search size={14} className="shrink-0 text-[var(--muted)]" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search pages, projects, keys, providers…"
                className="flex-1 border-none bg-transparent text-[13px] text-[var(--text)] outline-none placeholder:text-[var(--muted)]"
              />
              <div className="flex shrink-0 items-center gap-1.5">
                {query ? (
                  <button
                    type="button"
                    onClick={() => setQuery("")}
                    className="flex size-6 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--overlay)] hover:text-[var(--text)]"
                    aria-label="Clear"
                  >
                    <X size={13} />
                  </button>
                ) : null}
                <kbd className="hidden h-6 items-center rounded-md border border-[var(--border)] px-1.5 text-[11px] text-[var(--muted)] sm:flex">
                  Esc
                </kbd>
              </div>
            </div>

            <div className="max-h-[min(60vh,420px)] overflow-y-auto py-1">
              {pending ? (
                <div className="py-5 text-center text-[13px] text-[var(--muted)]">Searching…</div>
              ) : null}

              {!pending && hasQuery && total === 0 ? (
                <div className="py-8 text-center text-[13px] text-[var(--muted)]">
                  No results for <span className="font-medium text-[var(--text)]">&ldquo;{query}&rdquo;</span>
                </div>
              ) : null}

              {pageHits.length > 0 ? (
                <div>
                  <div className="px-3 pt-2 pb-1 text-[12px] text-[var(--muted)]">Pages</div>
                  {pageHits.map((p) => {
                    const Icon = p.icon;
                    return (
                      <ResultRow key={p.href} onClick={() => go(p.href)}>
                        <span className="grid size-7 place-items-center rounded-md bg-[var(--surface-2)] text-[var(--muted)]">
                          <Icon size={14} />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-[13px] font-medium text-[var(--text)]">{p.label}</span>
                          <span className="block truncate text-[12px] text-[var(--muted)]">{p.hint}</span>
                        </span>
                      </ResultRow>
                    );
                  })}
                </div>
              ) : null}

              {entityHits.length > 0 ? (
                <div>
                  <div className="px-3 pt-2 pb-1 text-[12px] text-[var(--muted)]">Results</div>
                  {entityHits.map((h, i) => (
                    <ResultRow key={`${h.kind}-${h.label}-${i}`} onClick={() => go(h.href)}>
                      <span className="min-w-0 pl-1">
                        <span className="block text-[13px] font-medium text-[var(--text)]">{h.label}</span>
                        <span className="block truncate text-[12px] text-[var(--muted)]">
                          {h.kind} · {h.hint}
                        </span>
                      </span>
                    </ResultRow>
                  ))}
                </div>
              ) : null}
            </div>
          </DialogPrimitive.Content>
        </DialogPortal>
      </DialogPrimitive.Root>
    </>
  );
}
