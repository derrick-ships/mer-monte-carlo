// IndexedDB wrapper for saved scenarios + visit counter for the install prompt.
// Plain async/await; no external IDB library — the API surface is small.

import type { SimConfig } from '../math/simulator.js';

const DB_NAME = 'mer-pwa';
const DB_VERSION = 1;
const STORE_SCENARIOS = 'scenarios';
const STORE_META = 'meta';

export type StoredScenario = {
  id: string;
  name: string;
  createdAt: number;
  config: SimConfig;
  /** Headline median MER from the simulation that produced this scenario. */
  headlineMedianMER: number;
};

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_SCENARIOS)) {
        db.createObjectStore(STORE_SCENARIOS, { keyPath: 'id' });
      }
      if (!db.objectStoreNames.contains(STORE_META)) {
        db.createObjectStore(STORE_META);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

function tx<T>(
  storeName: string,
  mode: IDBTransactionMode,
  fn: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const t = db.transaction(storeName, mode);
        const r = fn(t.objectStore(storeName));
        r.onsuccess = () => resolve(r.result);
        r.onerror = () => reject(r.error);
        t.oncomplete = () => db.close();
      }),
  );
}

export function saveScenario(s: StoredScenario): Promise<IDBValidKey> {
  return tx(STORE_SCENARIOS, 'readwrite', (store) => store.put(s));
}

export function listScenarios(): Promise<StoredScenario[]> {
  return tx(STORE_SCENARIOS, 'readonly', (store) => store.getAll() as IDBRequest<StoredScenario[]>);
}

export function deleteScenario(id: string): Promise<undefined> {
  return tx(STORE_SCENARIOS, 'readwrite', (store) => store.delete(id) as IDBRequest<undefined>);
}

export async function incrementVisitCount(): Promise<number> {
  const current = (await tx(STORE_META, 'readonly', (s) => s.get('visitCount'))) as
    | number
    | undefined;
  const next = (current ?? 0) + 1;
  await tx(STORE_META, 'readwrite', (s) => s.put(next, 'visitCount'));
  return next;
}
