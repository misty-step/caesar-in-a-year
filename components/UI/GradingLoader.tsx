'use client';

import React, { useState, useEffect } from 'react';
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

export const GradingLoader: React.FC<GradingLoaderProps> = ({ className = '' }) => {
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
      className={`rounded-card bg-slate-50 border border-slate-200 p-8 text-center space-y-4 animate-fade-in ${className}`}
    >
      {/* Animated dots */}
      <div className="flex justify-center space-x-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-3 h-3 bg-tyrian-500 rounded-full animate-bounce"
            style={{ animationDelay: `${i * 150}ms` }}
          />
        ))}
      </div>

      {/* Rotating message */}
      <div className="transition-opacity duration-300">
        <p className="text-lg font-serif text-ink-light">
          <LatinText latin={message.latin} english={message.english} />
        </p>
      </div>

      {/* Subtle timing hint */}
      <p className="text-xs text-ink-faint">
        Usually takes 2-5 seconds
      </p>
    </div>
  );
};
