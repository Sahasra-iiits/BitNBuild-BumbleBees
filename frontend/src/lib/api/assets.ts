import { API_BASE, apiFetch, ApiRequestError, refreshAccessToken, tokenStore } from './client';
import type { ExperimentAsset } from '../types/api';

export const ASSET_LIMITS = {
  IMAGE: { maxBytes: 10 * 1024 * 1024, accept: 'image/png,image/jpeg,image/gif,image/webp', label: 'PNG, JPEG, GIF or WebP up to 10 MB' },
  AUDIO: {
    maxBytes: 25 * 1024 * 1024,
    accept: 'audio/mpeg,audio/wav,audio/x-wav,audio/ogg,audio/flac,audio/aac,audio/mp4,audio/x-m4a,audio/webm',
    label: 'MP3, WAV, OGG, FLAC, AAC, M4A or WebM up to 25 MB',
  },
} as const;

/** Client-side pre-check; the server re-checks the actual file content. */
export function checkAssetFile(file: File, kind: 'IMAGE' | 'AUDIO'): string | null {
  const expected = kind === 'IMAGE' ? 'image/' : 'audio/';
  if (file.type && !file.type.startsWith(expected)) return `This is not ${kind === 'IMAGE' ? 'an image' : 'an audio'} file.`;
  if (file.type === 'image/svg+xml') return 'SVG images are not supported.';
  if (file.size === 0) return 'The file is empty.';
  if (file.size > ASSET_LIMITS[kind].maxBytes) return `The file is too large (max ${ASSET_LIMITS[kind].maxBytes / (1024 * 1024)} MB).`;
  return null;
}

function xhrUpload(experimentId: string, file: File, onProgress?: (fraction: number) => void, signal?: AbortSignal) {
  return new Promise<{ status: number; body: string; requestId?: string }>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', `${API_BASE}/experiments/${experimentId}/assets`);
    xhr.withCredentials = true;
    const token = tokenStore.get();
    if (token) xhr.setRequestHeader('Authorization', `Bearer ${token}`);
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(e.loaded / e.total);
    };
    xhr.onload = () => resolve({ status: xhr.status, body: xhr.responseText, requestId: xhr.getResponseHeader('X-Request-Id') ?? undefined });
    xhr.onerror = () => reject(new TypeError('Network error during upload'));
    xhr.onabort = () => reject(new DOMException('Upload cancelled', 'AbortError'));
    signal?.addEventListener('abort', () => xhr.abort());
    const form = new FormData();
    form.append('file', file);
    xhr.send(form);
  });
}

export const assetsApi = {
  /** Uploads with progress reporting (XHR, since fetch cannot report upload progress). */
  upload: async (experimentId: string, file: File, onProgress?: (fraction: number) => void, signal?: AbortSignal): Promise<ExperimentAsset> => {
    let res = await xhrUpload(experimentId, file, onProgress, signal);
    if (res.status === 401 && (await refreshAccessToken())) res = await xhrUpload(experimentId, file, onProgress, signal);
    let parsed: unknown;
    try {
      parsed = JSON.parse(res.body);
    } catch {
      parsed = undefined;
    }
    if (res.status < 200 || res.status >= 300) {
      const err = (parsed as { error?: { code?: string; message?: string } } | undefined)?.error;
      throw new ApiRequestError(err?.message ?? `Upload failed (HTTP ${res.status})`, err?.code ?? 'UPLOAD_FAILED', res.status, res.requestId);
    }
    return parsed as ExperimentAsset;
  },

  /** Downloads an asset with the user's credentials. */
  fetchBlob: async (assetId: string, signal?: AbortSignal): Promise<Blob> => {
    const res = await apiFetch(`/assets/${assetId}/content`, { signal });
    return res.blob();
  },
};
