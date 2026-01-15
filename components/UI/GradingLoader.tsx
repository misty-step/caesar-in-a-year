'use client';

import React, { useState, useEffect } from 'react';
import { cn } from '@/lib/design';
import { LatinText } from './LatinText';

const loadingMessages = [
  { latin: 'Verba examinamus...', english: 'Examining your words...' },
  { latin: 'Grammaticam inspicimus...', english: 'Checking grammar...' },
  { latin: 'Sententiam ponderamus...', english: 'Weighing your translation...' },
  { latin: 'Mentem tuam scrutamur...', english: 'Analyzing your reasoning...' },
  { latin: 'Responsum aestimamus...', english: 'Evaluating your answer...' },
];

interface GradingLoaderProps {
  className?: string;
}

/**
 * AI grading loader with rotating Latin messages
 *
 * Uses semantic tokens:
 * - Surface background
 * - Border color
 * - Accent for animated dots
 * - Text hierarchy for messages
 */
export const GradingLoader: React.FC<GradingLoaderProps> = ({ className }) => {
  const [messageIndex, setMessageIndex] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % loadingMessages.length);
    }, 2000);

    return () => clearInterval(interval);
  }, []);

  const message = loadingMessages[messageIndex];

  return (
    <div
      className={cn(
        'rounded-card bg-surface border border-border p-8 text-center space-y-4 animate-fade-in',
        className
      )}
    >
      {/* Animated dots */}
      <div className="flex justify-center space-x-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-3 h-3 bg-accent rounded-full animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>

      {/* Rotating message */}
      <div className="transition-opacity duration-normal">
        <p className="text-lg font-serif text-text-secondary">
          <LatinText latin={message.latin} english={message.english} />
        </p>
      </div>

      {/* Subtle timing hint */}
      <p className="text-xs text-text-faint">Usually takes 2-5 seconds</p>
    </div>
  );
};
