'use client';

import React, { useState } from 'react';
import { GradeStatus, type VocabCard, type SessionStatus } from '@/lib/data/types';
import { type SimpleGradingResult } from '@/lib/ai/grading-utils';
import { Button } from '@/components/UI/Button';
import { LatinText } from '@/components/UI/LatinText';
import { Label } from '@/components/UI/Label';
import { GradingLoader } from '@/components/UI/GradingLoader';
import { cn } from '@/lib/design';

interface VocabDrillStepProps {
  vocab: VocabCard;
  sessionId: string;
  itemIndex: number;
  onAdvance: (payload: { nextIndex: number; status: SessionStatus }) => void;
}

interface FeedbackState {
  grading: SimpleGradingResult;
  userInput: string;
}

/**
 * Vocabulary drill step for word meaning practice.
 *
 * Uses semantic tokens:
 * - text-success/warning for status feedback
 * - bg-success-faint/warning-faint for feedback cards
 * - bg-surface for question cards
 */
export const VocabDrillStep: React.FC<VocabDrillStepProps> = ({
  vocab,
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
      const res = await fetch('/api/vocab-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          itemIndex,
          vocabCardId: vocab.id,
          userInput: input,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to grade answer');
      }

      const data = await res.json();
      setFeedback({ grading: data.grading, userInput: input });
      setAdvancePayload({ nextIndex: data.nextIndex ?? itemIndex + 1, status: data.status ?? 'active' });
    } catch (error) {
      console.error('Error submitting vocab drill', error);
      // Fallback: show error state
      setFeedback({
        grading: {
          status: GradeStatus.PARTIAL,
          feedback: "Couldn't check your answer. Compare with the expected meaning.",
        },
        userInput: input,
      });
      setAdvancePayload({ nextIndex: itemIndex + 1, status: 'active' });
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

  // All vocab questions are meaning-focused (latin_to_english)
  const label = { latin: 'Quid significat?', english: 'What does it mean?' };
  const isCorrect = feedback?.grading.status === GradeStatus.CORRECT;
  const isPartial = feedback?.grading.status === GradeStatus.PARTIAL;

  // Extract quoted word from question to show form context when it differs from latinWord
  const extractQuotedWord = (question: string): string | null => {
    const match = question.match(/['']([^'']+)['']/);
    return match ? match[1] : null;
  };
  const quotedForm = extractQuotedWord(vocab.question);
  const normalize = (s: string) => s.toLowerCase().replace(/\s+/g, '').replace(/\.\.\./g, '');
  const showFormSubtitle = quotedForm && normalize(quotedForm) !== normalize(vocab.latinWord);

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
      <div className="text-center space-y-2">
        <Label>
          <LatinText latin="Vocabulum" english="Vocabulary" />
        </Label>
        <h2 className="text-3xl md:text-4xl font-serif text-text-primary leading-tight">
          {showFormSubtitle ? quotedForm : vocab.latinWord}
        </h2>
        {showFormSubtitle && (
          <p className="text-sm text-text-muted">
            ({vocab.latinWord})
          </p>
        )}
      </div>

      {!feedback ? (
        isSubmitting ? (
          <GradingLoader />
        ) : (
          <div className="space-y-4">
            <div className="bg-surface rounded-lg p-4">
              <p className="font-medium text-text-primary">{vocab.question}</p>
            </div>
            <label className="block text-sm font-medium text-text-secondary">
              <LatinText latin={label.latin} english={label.english} />
            </label>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              className={cn(
                'w-full p-4 border border-border rounded-lg shadow-sm',
                'focus:ring-2 focus:ring-accent focus:border-accent',
                'text-lg font-sans bg-white'
              )}
              placeholder="Write your answer..."
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
          className={cn(
            'rounded-lg p-6 border-l-4 space-y-5',
            isCorrect
              ? 'bg-success-faint border-success'
              : isPartial
                ? 'bg-warning-faint border-warning'
                : 'bg-surface border-text-muted'
          )}
        >
          {/* Status header */}
          <div className="flex items-center space-x-2">
            <span
              className={cn(
                'text-lg font-bold',
                isCorrect
                  ? 'text-success'
                  : isPartial
                    ? 'text-warning'
                    : 'text-text-muted'
              )}
            >
              {isCorrect ? (
                <LatinText latin="Recte!" english="Correct!" />
              ) : isPartial ? (
                <LatinText latin="Paene!" english="Almost!" />
              ) : (
                <LatinText latin="Non recte." english="Not quite." />
              )}
            </span>
          </div>

          {/* AI Feedback */}
          <div className="text-text-primary">
            {feedback.grading.feedback}
          </div>

          {/* User's answer */}
          <div className="bg-white/50 rounded-lg p-4 space-y-1">
            <p className="text-xs text-text-muted uppercase tracking-[0.15em] font-semibold">
              <LatinText latin="Tua Responsio" english="Your Answer" />
            </p>
            <p className="text-text-primary italic">"{feedback.userInput}"</p>
          </div>

          {/* Correct answer */}
          <div className="bg-white/50 rounded-lg p-4 space-y-1">
            <p className="text-xs text-text-muted uppercase tracking-[0.15em] font-semibold">
              <LatinText latin="Responsio Vera" english="Correct Answer" />
            </p>
            <p className="font-medium text-text-primary">{vocab.answer}</p>
          </div>

          {/* Hint if provided */}
          {feedback.grading.hint && (
            <div className="bg-accent-faint rounded-lg p-4 text-sm text-accent">
              <span className="font-bold">Hint: </span>
              {feedback.grading.hint}
            </div>
          )}

          {/* Word meaning reminder */}
          <div className="text-sm text-text-secondary">
            <span className="font-bold">{vocab.latinWord}</span> = {vocab.meaning}
          </div>

          <div className="pt-4 flex justify-end">
            <Button onClick={handleContinue} labelLatin="Perge" labelEnglish="Continue" />
          </div>
        </div>
      )}
    </div>
  );
};
