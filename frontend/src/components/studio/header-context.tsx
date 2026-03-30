"use client";

import { createContext, useContext } from "react";

export type StudioHeaderConfig = {
  backHref?: string;
  title?: string;
  subtitle?: string;
  center?: React.ReactNode;
};

export type StudioHeaderController = {
  setHeader: (config: StudioHeaderConfig) => void;
  resetHeader: () => void;
};

export const StudioHeaderContext = createContext<StudioHeaderController | null>(null);

export function useStudioHeader() {
  const ctx = useContext(StudioHeaderContext);
  if (!ctx) {
    throw new Error("useStudioHeader must be used inside StudioLayout");
  }
  return ctx;
}
