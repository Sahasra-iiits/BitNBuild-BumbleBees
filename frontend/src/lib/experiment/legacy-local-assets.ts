// Read-only access to files that the previous builder stored in the researcher's
// browser (IndexedDB "BitNBuildAssets", referenced as asset://<id>). Those files
// were never visible to participants; the builder uses this reader once to upload
// them to the server and replace the references.

const DB_NAME = 'BitNBuildAssets';
const STORE = 'assets';

function openDb(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    if (typeof indexedDB === 'undefined') return resolve(null);
    let request: IDBOpenDBRequest;
    try {
      request = indexedDB.open(DB_NAME);
    } catch {
      return resolve(null);
    }
    request.onupgradeneeded = () => {
      // The database did not exist; abort creation so we do not leave an empty one behind.
      request.transaction?.abort();
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

export async function readLegacyAsset(ref: string): Promise<Blob | null> {
  if (!ref.startsWith('asset://')) return null;
  const db = await openDb();
  if (!db) return null;
  try {
    if (!db.objectStoreNames.contains(STORE)) return null;
    return await new Promise<Blob | null>((resolve) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get(ref.slice('asset://'.length));
      req.onsuccess = () => resolve(req.result instanceof Blob ? req.result : null);
      req.onerror = () => resolve(null);
    });
  } finally {
    db.close();
  }
}
