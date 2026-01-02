'use client';

import React, { useState } from 'react';
import { GradeStatus, type VocabCard, type SessionStatus } from '@/lib/data/types';
import { type SimpleGradingResult } from '@/lib/ai/grading-utils';
import { Button } from '@/components/UI/Button';
import { LatinText } from '@/components/UI/LatinText';
import { GradingLoader } from '@/components/UI/GradingLoader';

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

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
      <div className="text-center space-y-4">
        <span className="text-xs font-bold tracking-widest text-roman-500 uppercase">
          <LatinText latin="Vocabulum" english="Vocabulary" />
        </span>
        <h2 className="text-3xl md:text-4xl font-serif text-roman-900 leading-tight">
          {vocab.latinWord}
        </h2>
      </div>

      {!feedback ? (
        isSubmitting ? (
          <GradingLoader />
        ) : (
          <div className="space-y-4">
            <div className="bg-roman-100 rounded-lg p-4">
              <p className="font-medium text-roman-900">{vocab.question}</p>
            </div>
            <label className="block text-sm font-medium text-roman-700">
              <LatinText latin={label.latin} english={label.english} />
            </label>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              className="w-full p-4 border-roman-300 rounded-lg shadow-sm focus:ring-pompeii-500 focus:border-pompeii-500 text-lg font-sans"
              placeholder="Scribe responsum..."
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
            isCorrect
              ? 'bg-laurel-50 border-laurel-500'
              : isPartial
                ? 'bg-amber-50 border-amber-500'
                : 'bg-iron-50 border-iron-500'
          }`}
        >
          {/* Status header */}
          <div className="flex items-center space-x-2">
            <span
              className={`text-lg font-bold ${
                isCorrect
                  ? 'text-laurel-700'
                  : isPartial
                    ? 'text-amber-700'
                    : 'text-iron-700'
              }`}
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
          <div className="text-roman-800">
            {feedback.grading.feedback}
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
            <p className="font-medium text-roman-800">{vocab.answer}</p>
          </div>

          {/* Hint if provided */}
          {feedback.grading.hint && (
            <div className="bg-pompeii-50 rounded-lg p-4 text-sm text-pompeii-800">
              <span className="font-bold">Hint: </span>
              {feedback.grading.hint}
            </div>
          )}

          {/* Word meaning reminder */}
          <div className="text-sm text-roman-700">
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
