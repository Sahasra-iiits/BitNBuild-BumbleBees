"use client";
// Display elements, rendered identically in the builder preview panel, the
// researcher preview and the participant runtime.

import { useEffect, useRef, useState } from 'react';
import type { AudioSoundElement, FixationCrossElement, ImageVisualElement, TextInstructionElement } from '@/shared/experiment';

export function TextStimulus({ element }: { element: TextInstructionElement }) {
  return <p className="text-2xl md:text-3xl font-medium text-slate-900 max-w-3xl leading-relaxed whitespace-pre-wrap text-center">{element.config.text}</p>;
}

export function FixationStimulus({ element }: { element: FixationCrossElement }) {
  const symbol = element.config.style === 'dot' ? '•' : element.config.style === 'circle' ? '○' : '+';
  return (
    <div className="text-7xl font-light text-slate-800 select-none leading-none" aria-label="Fixation point" role="img">
      {symbol}
    </div>
  );
}

export function ImageStimulus({ element, src }: { element: ImageVisualElement; src: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <div role="img" aria-label={element.config.altText || 'Image unavailable'} className="w-72 h-48 rounded-lg border-2 border-dashed border-red-300 bg-red-50 flex items-center justify-center text-sm text-red-700 text-center p-4">
        Image could not be loaded.
      </div>
    );
  }
  return (
    // Stimuli are object URLs or researcher-provided URLs; next/image optimization does not apply.
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt={element.config.altText} onError={() => setFailed(true)} className="max-w-full max-h-[55vh] object-contain rounded-lg" draggable={false} />
  );
}

type AudioState = 'ready' | 'playing' | 'blocked' | 'error' | 'ended';

/**
 * Audio playback that survives autoplay restrictions and broken files: a blocked
 * autoplay shows a Play button, a load error shows a message, and neither ends or
 * crashes the trial. Playback stops when the trial unmounts.
 */
export function AudioStimulus({ element, src }: { element: AudioSoundElement; src: string | null }) {
  const ref = useRef<HTMLAudioElement | null>(null);
  const [state, setState] = useState<AudioState>('ready');

  useEffect(() => {
    const audio = ref.current;
    if (!audio || !src || !element.config.autoplay) return;
    let cancelled = false;
    audio.play().catch((err: unknown) => {
      if (cancelled) return;
      setState(err instanceof DOMException && err.name === 'NotAllowedError' ? 'blocked' : 'error');
    });
    return () => {
      cancelled = true;
    };
  }, [src, element.config.autoplay]);

  useEffect(() => {
    const audio = ref.current;
    return () => audio?.pause();
  }, [src]);

  if (!src) {
    return <div className="rounded-lg border-2 border-dashed border-red-300 bg-red-50 px-4 py-3 text-sm text-red-700">Audio could not be loaded.</div>;
  }

  const play = () => {
    ref.current?.play().then(
      () => setState('playing'),
      () => setState('error')
    );
  };

  return (
    <div className="flex flex-col items-center gap-3">
      <audio
        ref={ref}
        src={src}
        preload="auto"
        controls
        onPlay={() => setState('playing')}
        onEnded={() => setState('ended')}
        onError={() => setState('error')}
        className="w-72"
        aria-label="Audio stimulus"
      />
      {state === 'blocked' && (
        <button type="button" onClick={play} className="px-5 py-2 rounded-full bg-slate-900 text-white text-sm font-medium hover:bg-slate-800">
          ▶ Play sound
        </button>
      )}
      {state === 'error' && <p className="text-sm text-red-600">This sound could not be played in your browser.</p>}
    </div>
  );
}
