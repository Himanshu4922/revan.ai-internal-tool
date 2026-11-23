"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export const sheetTh =
  "sticky top-0 z-20 h-9 border-b border-[var(--border)] bg-[var(--surface-2)] px-3 py-0 text-left align-middle text-[12px] font-medium normal-case tracking-normal text-[var(--muted)] whitespace-nowrap";

export const sheetTd =
  "border-b border-[var(--border)] px-3 py-2 align-middle text-[13px] text-[var(--text)]";

/** Full-bleed sheet host for list/data routes. */
export function AdminSheet({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex min-h-0 w-full flex-1 flex-col", className)}>
      {children}
    </div>
  );
}

/** Padded content for dashboard / settings / forms. */
export function AdminPad({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-full flex-1 overflow-auto px-4 py-5 sm:px-5 lg:px-6 lg:py-6",
        className
      )}
    >
      {children}
    </div>
  );
}

/**
 * Meetings / projects-style sheet: title + toolbar on the page,
 * table body scrolls underneath.
 */
export function DataSheet({
  title,
  count,
  toolbar,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  count?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      {title || toolbar ? (
        <div className="flex shrink-0 flex-col gap-2 border-b border-[var(--border)] px-3 py-2 sm:flex-row sm:flex-wrap sm:items-center">
          {title ? (
            <div className="flex min-w-0 items-center gap-2">
              <div className="px-1 text-[14px] font-medium text-[var(--text)]">{title}</div>
              {count != null ? (
                <span className="text-[12px] tabular-nums text-[var(--muted)]">{count}</span>
              ) : null}
            </div>
          ) : null}
          {toolbar ? (
            <div className="flex w-full min-w-0 flex-wrap items-center gap-2 sm:ml-auto sm:w-auto">
              {toolbar}
            </div>
          ) : null}
        </div>
      ) : null}
      <div className={cn("min-h-0 flex-1 overflow-auto", bodyClassName)}>{children}</div>
    </div>
  );
}
