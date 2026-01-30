'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { normalizeLatinText } from '@/lib/audio/textNormalization';
import { cn } from '@/lib/design';

// Global audio controller to auto-stop previous playback.
let globalController: { audio: HTMLAudioElement; stop: () => void } | null = null;

type AudioState = 'idle' | 'loading' | 'playing' | 'error';

interface AudioButtonProps {
  text: string;
  className?: string;
}

async function sha256Hex(input: string): Promise<string> {
  if (!globalThis.crypto?.subtle) {
    throw new Error('Web Crypto unavailable');
  }
  const bytes = new TextEncoder().encode(input);
  const hash = await globalThis.crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('');
}

async function generateAudioKeyClient(text: string): Promise<string> {
  const normalized = normalizeLatinText(text);
  const hash = await sha256Hex(normalized);
  return `v1-${hash.slice(0, 16)}.mp3`;
}

function getCdnUrl(baseUrl: string, key: string): string {
  const trimmed = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  return `${trimmed}/latin/${key}`;
}

export function AudioButton({ text, className }: AudioButtonProps) {
  const [state, setState] = useState<AudioState>('idle');
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const mountedRef = useRef(true);
  const recoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const safeSetState = useCallback((next: AudioState) => {
    if (mountedRef.current) {
      setState(next);
    }
  }, []);

  const clearRecoveryTimer = useCallback(() => {
    if (recoveryTimerRef.current) {
      clearTimeout(recoveryTimerRef.current);
      recoveryTimerRef.current = null;
    }
  }, []);

  const scheduleRecovery = useCallback(() => {
    clearRecoveryTimer();
    recoveryTimerRef.current = setTimeout(() => {
      safeSetState('idle');
    }, 2000);
  }, [clearRecoveryTimer, safeSetState]);

  const handleStop = useCallback(() => {
    clearRecoveryTimer();

    const currentAudio = audioRef.current;
    if (currentAudio) {
      currentAudio.pause();
      currentAudio.currentTime = 0;
      audioRef.current = null;
    }

    if (globalController?.audio === currentAudio) {
      globalController = null;
    }

    safeSetState('idle');
  }, [clearRecoveryTimer, safeSetState]);

  const handlePlay = useCallback(async () => {
    if (state === 'loading') return;

    clearRecoveryTimer();
    globalController?.stop();

    safeSetState('loading');

    try {
      const key = await generateAudioKeyClient(text);
      const cdnBaseUrl = process.env.NEXT_PUBLIC_BLOB_URL;
      let audioUrl: string | null = null;

      if (cdnBaseUrl) {
        const cdnUrl = getCdnUrl(cdnBaseUrl, key);
        const cdnCheck = await fetch(cdnUrl, { method: 'HEAD' }).catch(() => null);
        if (cdnCheck?.ok) {
          audioUrl = cdnUrl;
        }
      }

      if (!audioUrl) {
        const res = await fetch('/api/tts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text }),
        });

        if (!res.ok) {
          throw new Error('TTS failed');
        }

        const data = (await res.json()) as { url?: string };
        if (!data.url) {
          throw new Error('TTS missing url');
        }
        audioUrl = data.url;
      }

      const audio = new Audio(audioUrl);
      audioRef.current = audio;

      globalController = {
        audio,
        stop: () => {
          if (audioRef.current === audio) {
            audio.pause();
            audio.currentTime = 0;
            audioRef.current = null;
          }
          if (globalController?.audio === audio) {
            globalController = null;
          }
          safeSetState('idle');
        },
      };

      audio.onended = () => {
        if (globalController?.audio === audio) {
          globalController = null;
        }
        if (audioRef.current === audio) {
          audioRef.current = null;
        }
        safeSetState('idle');
      };

      audio.onerror = () => {
        if (globalController?.audio === audio) {
          globalController = null;
        }
        if (audioRef.current === audio) {
          audioRef.current = null;
        }
        safeSetState('error');
        scheduleRecovery();
      };

      await audio.play();
      safeSetState('playing');
    } catch (error) {
      console.error('Audio playback failed:', error);
      toast.error('Audio unavailable. Try again soon.');
      safeSetState('error');
      scheduleRecovery();
    }
  }, [clearRecoveryTimer, safeSetState, scheduleRecovery, state, text]);

  useEffect(() => {
    return () => {
      mountedRef.current = false;
      clearRecoveryTimer();
      if (globalController?.audio === audioRef.current) {
        globalController.stop();
      }
    };
  }, [clearRecoveryTimer]);

  const isPlaying = state === 'playing';

  return (
    <button
      type="button"
      onClick={isPlaying ? handleStop : handlePlay}
      disabled={state === 'loading'}
      aria-label={isPlaying ? 'Stop audio' : `Play pronunciation of ${text.slice(0, 30)}`}
      className={cn(
        'inline-flex items-center justify-center rounded p-1 transition-colors duration-fast',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent',
        state === 'idle' && 'text-text-muted hover:text-accent',
        state === 'loading' && 'text-text-muted animate-pulse',
        state === 'playing' && 'text-accent',
        state === 'error' && 'text-warning',
        className
      )}
    >
      {isPlaying ? (
        <svg className="size-6" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
          <rect x="6" y="6" width="8" height="8" rx="1" />
        </svg>
      ) : (
        <svg
          className="size-6"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M19.114 5.636a9 9 0 010 12.728M16.463 8.288a5.25 5.25 0 010 7.424M6.75 8.25l4.72-4.72a.75.75 0 011.28.53v15.88a.75.75 0 01-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.01 9.01 0 012.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75z"
          />
        </svg>
      )}
    </button>
  );
}
