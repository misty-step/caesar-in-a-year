'use client';

import { useState, useEffect } from 'react';
import { Card } from '@/components/UI/Card';
import { Button } from '@/components/UI/Button';
import { LatinText } from '@/components/UI/LatinText';
import { Label } from '@/components/UI/Label';
import { cn } from '@/lib/design';

const DISMISSED_KEY = 'caesar-first-session-dismissed';

/**
 * First-session guidance card for Day 1 users.
 *
 * Explains the core learning loop: sessions, FSRS scheduling, and what to expect.
 * Dismissable via "Got it" button with localStorage persistence.
 */
export function FirstSessionGuidance() {
  const [dismissed, setDismissed] = useState(true); // Start hidden to avoid flash

  useEffect(() => {
    try {
      setDismissed(localStorage.getItem(DISMISSED_KEY) === 'true');
    } catch {
      // localStorage unavailable (e.g. Safari private mode) — show the card
      setDismissed(false);
    }
  }, []);

  if (dismissed) return null;

  function handleDismiss() {
    try {
      localStorage.setItem(DISMISSED_KEY, 'true');
    } catch {
      // localStorage unavailable — dismiss for this session only
    }
    setDismissed(true);
  }

  return (
    <Card
      as="section"
      elevation="raised"
      padding="md"
      className="animate-fade-in space-y-4"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <Label>
            <LatinText latin="Salvete, Discipule" english="Welcome, Student" />
          </Label>
          <h2 className="text-lg font-serif font-semibold text-text-primary">
            <LatinText
              latin="Quid exspectes hodie"
              english="What to expect today"
            />
          </h2>
        </div>
        <button
          onClick={handleDismiss}
          className={cn(
            'text-text-muted hover:text-text-primary transition-colors p-1 shrink-0',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded'
          )}
          aria-label="Dismiss guidance"
        >
          <svg className="size-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <div className="space-y-2 text-sm text-text-secondary">
        <p>
          Each <strong className="text-text-primary">session</strong> is a short daily exercise: you'll translate Latin sentences and read a brief passage with glossary support.
        </p>
        <p>
          Sentences you've seen come back for review using spaced repetition — you'll see them again in a few days, then a week, then longer as you master them.
        </p>
        <p>
          Today's session takes about 10 minutes. Start whenever you're ready.
        </p>
      </div>

      <div className="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          labelLatin="Intellego"
          labelEnglish="Got it"
          onClick={handleDismiss}
        />
      </div>
    </Card>
  );
}
