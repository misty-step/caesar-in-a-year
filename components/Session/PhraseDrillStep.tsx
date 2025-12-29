'use client';

import React, { useState } from 'react';
import { type PhraseCard, type SessionStatus } from '@/lib/data/types';
import { Button } from '@/components/UI/Button';
import { LatinText } from '@/components/UI/LatinText';

interface PhraseDrillStepProps {
  phrase: PhraseCard;
  sessionId: string;
  itemIndex: number;
  onAdvance: (payload: { nextIndex: number; status: SessionStatus }) => void;
}

interface FeedbackState {
  isCorrect: boolean;
  userInput: string;
}

/**
 * Normalize text for comparison: lowercase, remove punctuation, normalize whitespace.
 */
function normalizeForComparison(text: string): string {
  return text
    .toLowerCase()
    .replace(/[.,;:!?'"()-]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if user answer is close enough to correct answer.
 * Uses word overlap to allow for minor variations.
 */
function isAnswerClose(userAnswer: string, correctAnswer: string): boolean {
  const userNorm = normalizeForComparison(userAnswer);
  const correctNorm = normalizeForComparison(correctAnswer);

  // Exact match after normalization
  if (userNorm === correctNorm) return true;

  // Word overlap check - at least 60% of words must match
  const userWords = new Set(userNorm.split(' '));
  const correctWords = correctNorm.split(' ');
  const matchCount = correctWords.filter(w => userWords.has(w)).length;
  const overlapRatio = matchCount / correctWords.length;

  return overlapRatio >= 0.6;
}

export const PhraseDrillStep: React.FC<PhraseDrillStepProps> = ({
  phrase,
  sessionId,
  itemIndex,
  onAdvance,
}) => {
  const [input, setInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [advancePayload, setAdvancePayload] = useState<{ nextIndex: number; status: SessionStatus } | null>(null);

  const handleSubmit = async () => {
    if (!input.trim() || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const isCorrect = isAnswerClose(input, phrase.english);

      // Call API to record the phrase review and update FSRS
      const res = await fetch('/api/phrase-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          itemIndex,
          phraseCardId: phrase.id,
          userInput: input,
          isCorrect,
        }),
      });

      if (!res.ok) {
        console.error('Failed to record phrase review');
      }

      const data = await res.json();
      setFeedback({ isCorrect, userInput: input });
      setAdvancePayload({ nextIndex: data.nextIndex ?? itemIndex + 1, status: data.status ?? 'active' });
    } catch (error) {
      console.error('Error submitting phrase drill', error);
      // Even on error, show feedback based on local comparison
      const isCorrect = isAnswerClose(input, phrase.english);
      setFeedback({ isCorrect, userInput: input });
      setAdvancePayload(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleContinue = () => {
    if (advancePayload) {
      onAdvance(advancePayload);
    }
    setFeedback(null);
    setInput('');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
      <div className="text-center space-y-4">
        <span className="text-xs font-bold tracking-widest text-roman-500 uppercase">
          <LatinText latin="Locutio" english="Phrase" />
        </span>
        <h2 className="text-3xl md:text-4xl font-serif text-roman-900 leading-tight">
          {phrase.latin}
        </h2>
        {phrase.context && (
          <p className="text-sm text-roman-500 italic">
            {phrase.context}
          </p>
        )}
      </div>

      {!feedback ? (
        isSubmitting ? (
          <div className="rounded-lg bg-roman-50 border border-roman-200 p-8 text-center space-y-3 animate-fade-in">
            <p className="text-lg font-serif text-roman-700 animate-pulse">
              VERBA EXAMINAMUS...
            </p>
            <p className="text-sm text-roman-500">
              Checking your answer
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-roman-700">
              <LatinText latin="Verte in Anglicum" english="Translate to English" />
            </label>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              className="w-full p-4 border-roman-300 rounded-lg shadow-sm focus:ring-pompeii-500 focus:border-pompeii-500 text-lg font-sans"
              placeholder="Type your translation..."
              autoFocus
            />
            <div className="flex justify-end">
              <Button
                onClick={handleSubmit}
                disabled={!input.trim()}
                labelLatin="Confirma"
                labelEnglish="Check"
              />
            </div>
          </div>
        )
      ) : (
        <div
          className={`rounded-lg p-6 border-l-4 space-y-5 ${
            feedback.isCorrect
              ? 'bg-laurel-50 border-laurel-500'
              : 'bg-iron-50 border-iron-500'
          }`}
        >
          {/* Status header */}
          <div className="flex items-center space-x-2">
            <span
              className={`text-lg font-bold ${
                feedback.isCorrect ? 'text-laurel-700' : 'text-iron-700'
              }`}
            >
              {feedback.isCorrect ? (
                <LatinText latin="Recte!" english="Correct!" />
              ) : (
                <LatinText latin="Non recte." english="Not quite." />
              )}
            </span>
          </div>

          {/* User's answer */}
          <div className="bg-white/50 rounded-lg p-4 space-y-1">
            <p className="text-xs text-roman-500 uppercase tracking-wide font-bold">
              <LatinText latin="Tua Responsio" english="Your Answer" />
            </p>
            <p className="text-roman-800 italic">"{feedback.userInput}"</p>
          </div>

          {/* Correct answer */}
          <div className="bg-white/50 rounded-lg p-4 space-y-1">
            <p className="text-xs text-roman-500 uppercase tracking-wide font-bold">
              <LatinText latin="Responsio Vera" english="Correct Answer" />
            </p>
            <p className="font-medium text-roman-800">{phrase.english}</p>
          </div>

          {/* Latin phrase reminder */}
          <div className="text-sm text-roman-700">
            <span className="font-bold">{phrase.latin}</span> = {phrase.english}
          </div>

          <div className="pt-4 flex justify-end">
            <Button onClick={handleContinue} labelLatin="Perge" labelEnglish="Continue" />
          </div>
        </div>
      )}
    </div>
  );
};
