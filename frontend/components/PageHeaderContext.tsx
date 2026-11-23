"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";

type PageHeaderContextValue = {
  title: ReactNode;
  description: ReactNode;
  setTitle: (title: ReactNode, description?: ReactNode) => void;
  actionsHost: HTMLElement | null;
  setActionsHost: (el: HTMLElement | null) => void;
};

const PageHeaderContext = createContext<PageHeaderContextValue | null>(null);

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [title, setTitleState] = useState<ReactNode>(null);
  const [description, setDescriptionState] = useState<ReactNode>(null);
  const [actionsHost, setActionsHost] = useState<HTMLElement | null>(null);

  const setTitle = useCallback((nextTitle: ReactNode, nextDescription?: ReactNode) => {
    setTitleState(nextTitle);
    setDescriptionState(nextDescription ?? null);
  }, []);

  useEffect(() => {
    setTitleState(null);
    setDescriptionState(null);
  }, [pathname]);

  const value = useMemo(
    () => ({
      title,
      description,
      setTitle,
      actionsHost,
      setActionsHost,
    }),
    [title, description, setTitle, actionsHost]
  );

  return (
    <PageHeaderContext.Provider value={value}>{children}</PageHeaderContext.Provider>
  );
}

export function usePageHeader() {
  const ctx = useContext(PageHeaderContext);
  if (!ctx) {
    throw new Error("usePageHeader must be used within PageHeaderProvider");
  }
  return ctx;
}

/** Push title into the shell topbar; portal actions into the header actions slot. */
export function useSetPageHeader({
  title,
  description,
  actions,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  const { setTitle, actionsHost } = usePageHeader();

  useEffect(() => {
    setTitle(title ?? null, description ?? null);
    return () => setTitle(null, null);
  }, [setTitle, title, description]);

  if (!actions || !actionsHost) return null;
  return createPortal(actions, actionsHost);
}

/** Declarative helper — same as useSetPageHeader. */
export function SetPageHeader({
  title,
  description,
  actions,
}: {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return useSetPageHeader({ title, description, actions });
}
