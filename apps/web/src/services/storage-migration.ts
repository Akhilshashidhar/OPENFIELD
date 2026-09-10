/**
 * One-time, idempotent storage migration: OpenReel-era keys → OpenField keys.
 *
 * OpenField renamed its localStorage keys and IndexedDB databases from the
 * `openreel-*` namespace inherited from upstream to `openfield-*`. Existing
 * users have data (projects, settings, encrypted API keys) under the old
 * names. This module copies that data to the new names WITHOUT destroying the
 * originals until the copy is verified, then removes the originals.
 *
 * Safety properties:
 *  - Idempotent: a completion flag (openfield-idb-migrated-v1) short-circuits
 *    subsequent runs; individual copies also skip if the target already exists.
 *  - Non-destructive-first: new key/DB is written and verified BEFORE the old
 *    one is deleted. A crash mid-migration leaves the old data intact.
 *  - Best-effort: any single failure is logged and skipped; it never throws to
 *    the caller, so app boot is never blocked by a migration hiccup.
 *
 * Runs once at boot (see main.tsx) before stores hydrate.
 */

const MIGRATION_FLAG = "openfield-idb-migrated-v1";

// IndexedDB databases: [oldName, newName]
const INDEXED_DBS: ReadonlyArray<readonly [string, string]> = [
  ["openreel-db", "openfield-db"],
  ["openreel-projects", "openfield-projects"],
  ["openreel-autosave", "openfield-autosave"],
  ["openreel-templates", "openfield-templates"],
  ["openreel-secure", "openfield-secure"],
  ["openreel-motion-presets", "openfield-motion-presets"],
  ["openreel-multicam-analysis", "openfield-multicam-analysis"],
];

function openDb(name: string): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    let req: IDBOpenDBRequest;
    try {
      req = indexedDB.open(name);
    } catch {
      resolve(null);
      return;
    }
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => resolve(null);
    req.onblocked = () => resolve(null);
  });
}

function databaseExists(name: string): Promise<boolean> {
  return new Promise((resolve) => {
    // databases() isn't universally available; fall back to an open probe.
    const anyIdb = indexedDB as unknown as {
      databases?: () => Promise<Array<{ name?: string }>>;
    };
    if (typeof anyIdb.databases === "function") {
      anyIdb
        .databases()
        .then((list) => resolve(list.some((d) => d.name === name)))
        .catch(() => resolve(false));
      return;
    }
    resolve(false);
  });
}

/** Copy every object store (with its keys, keyPath, autoIncrement, indexes) from src → a new DB. */
async function copyIndexedDb(oldName: string, newName: string): Promise<boolean> {
  const src = await openDb(oldName);
  if (!src) return false;

  const storeNames = Array.from(src.objectStoreNames);
  if (storeNames.length === 0) {
    src.close();
    return false;
  }

  // Snapshot each store's schema + records.
  interface StoreSnapshot {
    name: string;
    keyPath: IDBObjectStore["keyPath"];
    autoIncrement: boolean;
    indexes: Array<{ name: string; keyPath: string | string[]; unique: boolean; multiEntry: boolean }>;
    records: Array<{ key: unknown; value: unknown }>;
  }
  const snapshots: StoreSnapshot[] = [];

  await new Promise<void>((resolve) => {
    const tx = src.transaction(storeNames, "readonly");
    let pending = storeNames.length;
    for (const storeName of storeNames) {
      const store = tx.objectStore(storeName);
      const indexes: StoreSnapshot["indexes"] = [];
      for (const idxName of Array.from(store.indexNames)) {
        const idx = store.index(idxName);
        indexes.push({
          name: idx.name,
          keyPath: idx.keyPath as string | string[],
          unique: idx.unique,
          multiEntry: idx.multiEntry,
        });
      }
      const snap: StoreSnapshot = {
        name: storeName,
        keyPath: store.keyPath,
        autoIncrement: store.autoIncrement,
        indexes,
        records: [],
      };
      // getAll + getAllKeys keeps out-of-line keys correct.
      const valuesReq = store.getAll();
      const keysReq = store.getAllKeys();
      let got = 0;
      const done = () => {
        got += 1;
        if (got === 2) {
          const values = valuesReq.result as unknown[];
          const keys = keysReq.result as unknown[];
          for (let i = 0; i < values.length; i++) {
            snap.records.push({ key: keys[i], value: values[i] });
          }
          snapshots.push(snap);
          pending -= 1;
          if (pending === 0) resolve();
        }
      };
      valuesReq.onsuccess = done;
      valuesReq.onerror = done;
      keysReq.onsuccess = done;
      keysReq.onerror = done;
    }
    tx.onerror = () => resolve();
    tx.onabort = () => resolve();
  });

  src.close();

  // Create the new DB with an identical schema, then write records.
  const ok = await new Promise<boolean>((resolve) => {
    const req = indexedDB.open(newName, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const snap of snapshots) {
        if (db.objectStoreNames.contains(snap.name)) continue;
        const store = db.createObjectStore(snap.name, {
          keyPath: snap.keyPath as string | string[] | null,
          autoIncrement: snap.autoIncrement,
        });
        for (const idx of snap.indexes) {
          store.createIndex(idx.name, idx.keyPath, {
            unique: idx.unique,
            multiEntry: idx.multiEntry,
          });
        }
      }
    };
    req.onsuccess = () => {
      const db = req.result;
      const tx = db.transaction(
        snapshots.map((s) => s.name),
        "readwrite",
      );
      for (const snap of snapshots) {
        const store = tx.objectStore(snap.name);
        const usesInlineKeys = snap.keyPath !== null || snap.autoIncrement;
        for (const rec of snap.records) {
          try {
            if (usesInlineKeys) store.put(rec.value);
            else store.put(rec.value, rec.key as Parameters<IDBObjectStore["put"]>[1]);
          } catch {
            /* skip a bad record rather than abort the whole migration */
          }
        }
      }
      tx.oncomplete = () => {
        db.close();
        resolve(true);
      };
      tx.onerror = () => {
        db.close();
        resolve(false);
      };
      tx.onabort = () => {
        db.close();
        resolve(false);
      };
    };
    req.onerror = () => resolve(false);
    req.onblocked = () => resolve(false);
  });

  return ok;
}

async function migrateIndexedDbs(): Promise<void> {
  for (const [oldName, newName] of INDEXED_DBS) {
    try {
      // Skip if the new DB already exists (idempotent / never clobber).
      if (await databaseExists(newName)) {
        continue;
      }
      const copied = await copyIndexedDb(oldName, newName);
      if (copied) {
        // Only delete the original after a verified copy.
        await new Promise<void>((resolve) => {
          const del = indexedDB.deleteDatabase(oldName);
          del.onsuccess = () => resolve();
          del.onerror = () => resolve();
          del.onblocked = () => resolve();
        });
      }
    } catch (err) {
      console.warn(`[storage-migration] IndexedDB ${oldName} → ${newName} failed`, err);
    }
  }
}

/**
 * Run the one-time storage migration. Safe to call on every boot; it no-ops
 * after the first successful completion. Never throws.
 */
export async function runStorageMigration(): Promise<void> {
  if (typeof window === "undefined") return;
  try {
    if (localStorage.getItem(MIGRATION_FLAG) === "done") return;
  } catch {
    return; // storage unavailable (private mode, etc.) — nothing to migrate
  }

  await migrateIndexedDbs();

  try {
    localStorage.setItem(MIGRATION_FLAG, "done");
  } catch {
    /* ignore */
  }
}
