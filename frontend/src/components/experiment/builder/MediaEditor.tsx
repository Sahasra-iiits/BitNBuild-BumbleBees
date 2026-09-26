"use client";
import { useEffect, useRef, useState } from 'react';
import { Upload, X } from 'lucide-react';
import { assetsApi, ASSET_LIMITS, checkAssetFile } from '@/lib/api/assets';
import { errorMessage } from '@/lib/api/client';
import type { AssetCache } from '@/lib/experiment/asset-cache';
import type { AudioSoundElement, ImageVisualElement } from '@/shared/experiment';
import { Field, inputClass, TextField, Toggle } from './fields';

type MediaElement = ImageVisualElement | AudioSoundElement;

function AssetPreview({ kind, assetId, cache }: { kind: 'IMAGE' | 'AUDIO'; assetId: string; cache: AssetCache }) {
  const [state, setState] = useState<{ assetId: string; src: string | null; error: string | null }>({ assetId, src: cache.get(assetId) ?? null, error: null });
  if (state.assetId !== assetId) setState({ assetId, src: cache.get(assetId) ?? null, error: null });

  useEffect(() => {
    if (cache.get(assetId)) return;
    let cancelled = false;
    cache.load(assetId).then(
      (src) => !cancelled && setState({ assetId, src, error: null }),
      (err: unknown) => !cancelled && setState({ assetId, src: null, error: errorMessage(err, 'Could not load the file.') })
    );
    return () => {
      cancelled = true;
    };
  }, [assetId, cache]);

  if (state.error) return <p className="text-xs text-red-600">Preview unavailable: {state.error}</p>;
  if (!state.src) return <div className="h-24 rounded bg-slate-100 animate-pulse" aria-label="Loading preview" />;
  return kind === 'IMAGE' ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={state.src} alt="" className="max-h-40 rounded border border-slate-200 object-contain bg-slate-50" />
  ) : (
    <audio src={state.src} controls className="w-full" preload="metadata" />
  );
}

export function MediaEditor({
  element,
  experimentId,
  cache,
  onChange,
}: {
  element: MediaElement;
  experimentId: string;
  cache: AssetCache;
  /** Receives a function so a finished upload is applied to the latest element state. */
  onChange: (fn: (el: MediaElement) => MediaElement) => void;
}) {
  const kind = element.type === 'IMAGE_VISUAL' ? 'IMAGE' : 'AUDIO';
  const [upload, setUpload] = useState<{ progress: number; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => () => controllerRef.current?.abort(), []);

  const startUpload = async (file: File) => {
    setError(null);
    const problem = checkAssetFile(file, kind);
    if (problem) {
      setError(problem);
      return;
    }
    // Replacing while an upload runs cancels the older one, so it can never win.
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;
    setUpload({ progress: 0, name: file.name });
    try {
      const asset = await assetsApi.upload(experimentId, file, (p) => setUpload((u) => (u ? { ...u, progress: p } : u)), controller.signal);
      if (controller.signal.aborted) return;
      onChange((el) => ({ ...el, config: { ...el.config, assetId: asset.id, assetName: asset.originalName, url: '' } }) as MediaElement);
    } catch (err) {
      if (controller.signal.aborted) return;
      setError(errorMessage(err, 'Upload failed.'));
    } finally {
      if (controllerRef.current === controller) {
        controllerRef.current = null;
        setUpload(null);
      }
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  const cancelUpload = () => {
    controllerRef.current?.abort();
    controllerRef.current = null;
    setUpload(null);
  };

  const { assetId, assetName, url } = element.config;

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        <label className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border text-sm font-medium cursor-pointer ${upload ? 'opacity-50 pointer-events-none' : 'hover:bg-slate-50'}`}>
          <Upload className="w-4 h-4" />
          {assetId || url ? 'Replace file' : `Upload ${kind === 'IMAGE' ? 'image' : 'audio'}`}
          <input
            ref={inputRef}
            type="file"
            accept={ASSET_LIMITS[kind].accept}
            className="sr-only"
            disabled={!!upload}
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void startUpload(file);
            }}
          />
        </label>
        {(assetId || url) && !upload && (
          <button type="button" onClick={() => onChange((el) => ({ ...el, config: { ...el.config, assetId: null, assetName: '', url: '' } }) as MediaElement)} className="inline-flex items-center gap-1 px-2 py-1.5 text-sm text-slate-500 hover:text-red-600">
            <X className="w-4 h-4" /> Remove
          </button>
        )}
        <span className="text-xs text-slate-400">{ASSET_LIMITS[kind].label}</span>
      </div>

      {upload && (
        <div className="space-y-1" aria-live="polite">
          <div className="flex justify-between text-xs text-slate-600">
            <span className="truncate">Uploading {upload.name}…</span>
            <button type="button" onClick={cancelUpload} className="text-red-600 hover:underline">
              Cancel
            </button>
          </div>
          <div className="h-1.5 bg-slate-100 rounded">
            <div className="h-1.5 bg-blue-600 rounded transition-all" style={{ width: `${Math.round(upload.progress * 100)}%` }} />
          </div>
        </div>
      )}
      {error && (
        <p className="text-xs text-red-600" role="alert">
          {error}
        </p>
      )}

      {assetId ? (
        <div className="space-y-1">
          <p className="text-xs text-slate-500 truncate">File: {assetName || assetId}</p>
          <AssetPreview kind={kind} assetId={assetId} cache={cache} />
        </div>
      ) : (
        <Field label="…or an external URL (https://)">
          {(id) => (
            <input
              id={id}
              type="url"
              className={inputClass}
              value={url}
              placeholder="https://example.org/stimulus.png"
              onChange={(e) => onChange((el) => ({ ...el, config: { ...el.config, url: e.target.value.trim(), assetId: null, assetName: '' } }) as MediaElement)}
            />
          )}
        </Field>
      )}

      {element.type === 'IMAGE_VISUAL' ? (
        <TextField
          label="Alt text (for screen readers)"
          value={element.config.altText}
          maxLength={500}
          onChange={(altText) => onChange((el) => (el.type === 'IMAGE_VISUAL' ? { ...el, config: { ...el.config, altText } } : el))}
        />
      ) : (
        <Toggle
          label="Play automatically when the trial starts"
          hint="If the browser blocks autoplay, participants see a Play button."
          checked={element.config.autoplay}
          onChange={(autoplay) => onChange((el) => (el.type === 'AUDIO_SOUND' ? { ...el, config: { ...el.config, autoplay } } : el))}
        />
      )}
    </div>
  );
}
