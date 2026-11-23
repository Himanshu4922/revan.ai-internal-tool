"use client";

import { Search, X } from "lucide-react";

/** Compact in-sheet search field (project-by-ravan meetings/projects style). */
export function SheetSearch({
  value,
  onChange,
  placeholder = "Search…",
  "aria-label": ariaLabel = "Search",
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  "aria-label"?: string;
}) {
  return (
    <div className="relative min-w-0 flex-1 sm:max-w-[240px]">
      <Search
        size={13}
        className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-[var(--muted)]"
      />
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="h-8 w-full appearance-none rounded-md border border-solid border-[var(--border)] bg-[var(--surface-2)] pr-7 pl-7 text-[13px] text-[var(--text)] shadow-none outline-none placeholder:text-[var(--muted)] focus:border-[var(--border-strong)]"
      />
      {value ? (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute top-1/2 right-1.5 -translate-y-1/2 text-[var(--muted)] hover:text-[var(--text)]"
          aria-label="Clear search"
        >
          <X size={12} />
        </button>
      ) : null}
    </div>
  );
}
