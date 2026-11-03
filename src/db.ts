// A small promise-based wrapper around IndexedDB (the browser's built-in database).
// Everything the learner does is stored here, on the phone only.
//
// Stores:
//   cards    – one record per started word   (key: wordId)
//   reviews  – every flashcard / quiz answer (auto-numbered, indexed by date)
//   quiz     – every quiz answer             (auto-numbered, indexed by date)
//   meta     – settings and small values     (key: "key")

const DB_NAME = 'hsk-study';
const DB_VERSION = 1;

export type StoreName = 'cards' | 'reviews' | 'quiz' | 'meta';

let dbPromise: Promise<IDBDatabase> | null = null;

function open(): Promise<IDBDatabase> {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      // Version 1 schema. Add new "if (oldVersion < 2)" blocks here for future changes.
      db.createObjectStore('cards', { keyPath: 'wordId' });
      db.createObjectStore('reviews', { keyPath: 'id', autoIncrement: true }).createIndex('at', 'at');
      db.createObjectStore('quiz', { keyPath: 'id', autoIncrement: true }).createIndex('at', 'at');
      db.createObjectStore('meta', { keyPath: 'key' });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
  return dbPromise;
}

/** Turn an IDBRequest into a promise. */
function done<T>(req: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function store(name: StoreName, mode: IDBTransactionMode = 'readonly') {
  const db = await open();
  return db.transaction(name, mode).objectStore(name);
}

export async function getAll<T>(name: StoreName): Promise<T[]> {
  return done((await store(name)).getAll()) as Promise<T[]>;
}

export async function get<T>(name: StoreName, key: IDBValidKey): Promise<T | undefined> {
  return done((await store(name)).get(key)) as Promise<T | undefined>;
}

export async function put<T>(name: StoreName, value: T): Promise<void> {
  await done((await store(name, 'readwrite')).put(value));
}

export async function clear(name: StoreName): Promise<void> {
  await done((await store(name, 'readwrite')).clear());
}

/** All records whose "at" date is on or after `since` (reviews and quiz stores). */
export async function getSince<T>(name: 'reviews' | 'quiz', since: Date): Promise<T[]> {
  const index = (await store(name)).index('at');
  return done(index.getAll(IDBKeyRange.lowerBound(since))) as Promise<T[]>;
}

/** Write many records in one transaction (used by backup import). */
export async function putMany<T>(name: StoreName, values: T[]): Promise<void> {
  const db = await open();
  const tx = db.transaction(name, 'readwrite');
  const s = tx.objectStore(name);
  for (const v of values) s.put(v);
  await new Promise<void>((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/** Small key/value helpers on the "meta" store. */
export async function getMeta<T>(key: string): Promise<T | undefined> {
  const row = await get<{ key: string; value: T }>('meta', key);
  return row?.value;
}
export async function setMeta<T>(key: string, value: T): Promise<void> {
  await put('meta', { key, value });
}
