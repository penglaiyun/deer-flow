"use client";

import { createContext, useCallback, useContext, useMemo, useRef } from "react";

export type DirectorEventName = "asset.image.generate";
export type DirectorEventMethod =
  | "started"
  | "progress"
  | "completed"
  | "failed";

export type DirectorAssetTaskPayload = {
  taskId: string;
  assetType: "subject" | "variant" | "shot";
  subjectId?: number;
  variantId?: number;
  shotId?: number;
  storyboardId?: number;
  imageUrl?: string;
  status: "pending" | "processing" | "completed" | "failed" | "cancelled" | "timeout";
  error?: string;
  metadata?: Record<string, unknown>;
};

export type DirectorEvent = {
  id: string;
  name: DirectorEventName;
  method: DirectorEventMethod;
  ts: number;
  source: "assistant_stream" | "system";
  projectCode: string;
  episodeId?: number;
  payload: DirectorAssetTaskPayload;
};

type DirectorEventHandler = (event: DirectorEvent) => void;

type DirectorEventBusContextValue = {
  publish: (event: Omit<DirectorEvent, "id" | "ts">) => void;
  subscribe: (name: DirectorEventName, handler: DirectorEventHandler) => () => void;
};

const DirectorEventBusContext = createContext<DirectorEventBusContextValue | null>(null);

export function DirectorEventBusProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const handlersRef = useRef<Map<DirectorEventName, Set<DirectorEventHandler>>>(new Map());

  const publish = useCallback((event: Omit<DirectorEvent, "id" | "ts">) => {
    const fullEvent: DirectorEvent = {
      ...event,
      id: `${event.name}.${event.method}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      ts: Date.now(),
    };
    console.log("[DirectorEventBus] publish", fullEvent.name, fullEvent.method, fullEvent);
    const set = handlersRef.current.get(fullEvent.name);
    if (!set || set.size === 0) {
      return;
    }
    set.forEach((handler) => {
      handler(fullEvent);
    });
  }, []);

  const subscribe = useCallback((name: DirectorEventName, handler: DirectorEventHandler) => {
    console.log("[DirectorEventBus] subscribe", name);
    const map = handlersRef.current;
    if (!map.has(name)) {
      map.set(name, new Set());
    }
    map.get(name)!.add(handler);
    return () => {
      console.log("[DirectorEventBus] unsubscribe", name);
      const set = map.get(name);
      if (!set) {
        return;
      }
      set.delete(handler);
      if (set.size === 0) {
        map.delete(name);
      }
    };
  }, []);

  const value = useMemo<DirectorEventBusContextValue>(
    () => ({
      publish,
      subscribe,
    }),
    [publish, subscribe],
  );

  return (
    <DirectorEventBusContext.Provider value={value}>
      {children}
    </DirectorEventBusContext.Provider>
  );
}

export function useDirectorEventBus() {
  const ctx = useContext(DirectorEventBusContext);
  if (!ctx) {
    throw new Error("useDirectorEventBus must be used within DirectorEventBusProvider");
  }
  return ctx;
}
