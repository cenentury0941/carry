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

type AppBarApi = {
  meta: ReactNode | null;
  setMeta: (node: ReactNode | null) => void;
};

const AppBarCtx = createContext<AppBarApi | null>(null);

export function AppBarProvider({ children }: { children: ReactNode }) {
  const [meta, setMetaState] = useState<ReactNode | null>(null);
  const setMeta = useCallback((node: ReactNode | null) => {
    setMetaState(node);
  }, []);
  const value = useMemo(() => ({ meta, setMeta }), [meta, setMeta]);
  return <AppBarCtx.Provider value={value}>{children}</AppBarCtx.Provider>;
}

export function useAppBar() {
  const ctx = useContext(AppBarCtx);
  if (!ctx) throw new Error("useAppBar must be used within AppBarProvider");
  return ctx;
}

/** Publish app-bar meta while mounted; clears on unmount. */
export function useAppBarMeta(node: ReactNode | null) {
  const { setMeta } = useAppBar();
  useEffect(() => {
    setMeta(node);
    return () => setMeta(null);
  }, [node, setMeta]);
}
