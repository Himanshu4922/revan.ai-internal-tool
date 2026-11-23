"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { SetPageHeader } from "@/components/PageHeaderContext";

export const sheetTh =
  "sticky top-0 z-20 h-9 border-b border-[var(--border)] bg-[var(--surface-2)] px-3 text-left align-middle text-[12px] font-medium normal-case tracking-normal text-[var(--muted)] whitespace-nowrap";

export const sheetTd =
  "border-b border-[var(--border)] px-3 py-2 align-middle text-[13px] text-[var(--text)]";

/** Full-bleed sheet host for list/data routes (Vector7 AdminSheet). */
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

/** Full-bleed list page — title/toolbar render in the shell topbar. */
export function DataSheet({
  title,
  toolbar,
  children,
  className,
  bodyClassName,
}: {
  title?: ReactNode;
  toolbar?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}) {
  return (
    <div className={cn("flex h-full min-h-0 flex-col", className)}>
      <SetPageHeader title={title} actions={toolbar} />
      <div className={cn("min-h-0 flex-1 overflow-auto", bodyClassName)}>{children}</div>
    </div>
  );
}
