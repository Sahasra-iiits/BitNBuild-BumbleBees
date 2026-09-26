export const AssetStore = {
  dbPromise: null as Promise<IDBDatabase> | null,
  
  init() {
    this.dbPromise = new Promise((resolve, reject) => {
      const request = indexedDB.open('BitNBuildAssets', 1);
      request.onupgradeneeded = (e: any) => {
        if (!e.target.result.objectStoreNames.contains('assets')) {
          e.target.result.createObjectStore('assets');
        }
      };
      request.onsuccess = (e: any) => resolve(e.target.result);
      request.onerror = (e: any) => reject(e.target.error);
    });
  },

  async saveAsset(file: File | Blob): Promise<string> {
    if (!this.dbPromise) this.init();
    const db = await this.dbPromise!;
    
    // Create stable reference
    const id = typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2, 9);
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction('assets', 'readwrite');
      tx.objectStore('assets').put(file, id);
      tx.oncomplete = () => resolve(`asset://${id}`);
      tx.onerror = () => reject(tx.error);
    });
  },

  async getAssetUrl(assetUri: string): Promise<string> {
    if (!assetUri.startsWith('asset://')) return assetUri;
    
    if (!this.dbPromise) this.init();
    const db = await this.dbPromise!;
    const id = assetUri.replace('asset://', '');
    
    return new Promise((resolve, reject) => {
      const tx = db.transaction('assets', 'readonly');
      const req = tx.objectStore('assets').get(id);
      req.onsuccess = () => {
        if (req.result) {
          resolve(URL.createObjectURL(req.result));
        } else {
          resolve(assetUri); // Fallback to raw string if not found
        }
      };
      req.onerror = () => reject(req.error);
    });
  }
};
