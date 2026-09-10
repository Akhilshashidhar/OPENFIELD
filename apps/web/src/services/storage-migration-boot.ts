/**
 * Synchronous localStorage migration that MUST run before any zustand
 * `persist` store module is imported (those read localStorage at import time).
 *
 * Import this module FIRST in main.tsx — its top-level side effect performs
 * the localStorage half of the OpenReel → OpenField migration synchronously.
 * The heavier IndexedDB half runs asynchronously later (runStorageMigration).
 *
 * Idempotent and non-destructive-first: writes/verifies the new key before
 * removing the old one, and never clobbers an existing new key.
 */

const LOCAL_STORAGE_KEYS: ReadonlyArray<readonly [string, string]> = [
  ["openreel-settings", "openfield-settings"],
  ["openreel-ui-preferences", "openfield-ui-preferences"],
  ["openreel-theme", "openfield-theme"],
  ["openreel-timeline-workspace", "openfield-timeline-workspace"],
  ["openreel-ai-chat-history", "openfield-ai-chat-history"],
  ["openreel-custom-export-presets", "openfield-custom-export-presets"],
];

const LOCAL_FLAG = "openfield-localstorage-migrated-v1";

function migrateLocalStorageSync(): void {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(LOCAL_FLAG) === "done") return;
  } catch {
    return;
  }
  for (const [oldKey, newKey] of LOCAL_STORAGE_KEYS) {
    try {
      if (localStorage.getItem(newKey) !== null) {
        localStorage.removeItem(oldKey);
        continue;
      }
      const value = localStorage.getItem(oldKey);
      if (value === null) continue;
      localStorage.setItem(newKey, value);
      if (localStorage.getItem(newKey) === value) {
        localStorage.removeItem(oldKey);
      }
    } catch {
      /* skip a single failing key */
    }
  }
  try {
    localStorage.setItem(LOCAL_FLAG, "done");
  } catch {
    /* ignore */
  }
}

migrateLocalStorageSync();

export {};
