import { assetsApi } from '@/lib/api/assets';
import { collectAssetIds, type ExperimentDefinition, type MediaSourceConfig } from '@/shared/experiment';

/**
 * Holds object URLs for uploaded assets. Object URLs are only ever used for
 * display during a page's lifetime: the definition stores the permanent assetId,
 * and every URL created here is revoked in dispose().
 */
export class AssetCache {
  private readonly urls = new Map<string, string>();
  private readonly pending = new Map<string, Promise<string>>();
  /** Bumped by dispose() so loads started before it do not leak their object URLs. */
  private generation = 0;

  get(assetId: string): string | undefined {
    return this.urls.get(assetId);
  }

  load(assetId: string): Promise<string> {
    const cached = this.urls.get(assetId);
    if (cached) return Promise.resolve(cached);
    const inflight = this.pending.get(assetId);
    if (inflight) return inflight;
    const generation = this.generation;
    const promise = assetsApi
      .fetchBlob(assetId)
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        if (generation !== this.generation) {
          // Disposed while loading: the requester is gone, so release the URL immediately.
          URL.revokeObjectURL(url);
          throw new Error('Asset load cancelled');
        }
        this.urls.set(assetId, url);
        return url;
      })
      .finally(() => {
        if (this.pending.get(assetId) === promise) this.pending.delete(assetId);
      });
    this.pending.set(assetId, promise);
    return promise;
  }

  /** Loads every asset of a definition; reports progress and which assets failed. */
  async preload(definition: ExperimentDefinition, onProgress?: (done: number, total: number) => void): Promise<{ failed: string[] }> {
    const ids = collectAssetIds(definition);
    let done = 0;
    const failed: string[] = [];
    onProgress?.(0, ids.length);
    await Promise.all(
      ids.map(async (id) => {
        try {
          await this.load(id);
        } catch {
          failed.push(id);
        } finally {
          done += 1;
          onProgress?.(done, ids.length);
        }
      })
    );
    return { failed };
  }

  /**
   * Revokes every object URL. The cache stays usable afterwards (React StrictMode
   * unmounts and remounts components in development), reloading on demand.
   */
  dispose() {
    this.generation += 1;
    for (const url of this.urls.values()) URL.revokeObjectURL(url);
    this.urls.clear();
    this.pending.clear();
  }
}

/** The src to use for an image/audio element, or null if it is not available. */
export function mediaSrc(config: MediaSourceConfig, cache: AssetCache): string | null {
  if (config.assetId) return cache.get(config.assetId) ?? null;
  return config.url || null;
}
