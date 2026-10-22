// Тонкая обёртка над IndexedDB: всё хранится только на устройстве.
const DB_NAME = 'planka';
const VERSION = 1;
const STORES = {
  kv: null,
  days: 'date',
  projects: 'id',
  blobs: 'id',
};

let dbPromise = null;

function open() {
  if (!dbPromise) {
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        for (const [name, keyPath] of Object.entries(STORES)) {
          if (!db.objectStoreNames.contains(name)) {
            db.createObjectStore(name, keyPath ? { keyPath } : undefined);
          }
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  return dbPromise;
}

function wrap(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function run(store, mode, fn) {
  const db = await open();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(store, mode);
    const s = tx.objectStore(store);
    let result;
    Promise.resolve(fn(s)).then((v) => { result = v; }, reject);
    tx.oncomplete = () => resolve(result);
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error);
  });
}

export const kvGet = (key) => run('kv', 'readonly', (s) => wrap(s.get(key)));
export const kvSet = (key, value) => run('kv', 'readwrite', (s) => wrap(s.put(value, key)));
export const get = (store, key) => run(store, 'readonly', (s) => wrap(s.get(key)));
export const put = (store, value) => run(store, 'readwrite', (s) => wrap(s.put(value)));
export const del = (store, key) => run(store, 'readwrite', (s) => wrap(s.delete(key)));
export const all = (store) => run(store, 'readonly', (s) => wrap(s.getAll()));
export const clear = (store) => run(store, 'readwrite', (s) => wrap(s.clear()));

export async function wipeAll() {
  for (const name of Object.keys(STORES)) await clear(name);
}
