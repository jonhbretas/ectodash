"use client";

// Hydration-safe localStorage-backed preference state, built on
// useSyncExternalStore (the React-sanctioned way to read an external store
// without either effect-based setState churn or hydration mismatches):
//
//  - SSR/SSG always render the defaultValue (getServerSnapshot), so the
//    server HTML never depends on localStorage;
//  - the client snapshot is applied AFTER hydration by React itself, so
//    there is no "server HTML doesn't match" error and no flicker beyond a
//    single post-hydration re-render;
//  - writes notify this module's own subscriber set, so every instance
//    reading the same key (and the same tab) updates synchronously.
import { useCallback, useSyncExternalStore } from "react";

const subscribers = new Map<string, Set<() => void>>();

function subscribeTo(key: string, callback: () => void) {
  let set = subscribers.get(key);
  if (!set) {
    set = new Set();
    subscribers.set(key, set);
  }
  set.add(callback);
  return () => {
    set?.delete(callback);
  };
}

function emit(key: string) {
  subscribers.get(key)?.forEach((callback) => callback());
}

function read(key: string, fallback: string): string {
  try {
    return window.localStorage.getItem(key) ?? fallback;
  } catch {
    // localStorage unavailable (private mode, disabled storage) — the
    // preference simply does not persist.
    return fallback;
  }
}

export function useStoredPreference(
  key: string,
  defaultValue: string
): [string, (value: string) => void] {
  const subscribe = useCallback(
    (callback: () => void) => subscribeTo(key, callback),
    [key]
  );
  const getSnapshot = useCallback(() => read(key, defaultValue), [key, defaultValue]);
  const getServerSnapshot = useCallback(() => defaultValue, [defaultValue]);

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setValue = useCallback(
    (next: string) => {
      try {
        window.localStorage.setItem(key, next);
      } catch {
        // storage unavailable — state still updates for this session.
      }
      emit(key);
    },
    [key]
  );

  return [value, setValue];
}
