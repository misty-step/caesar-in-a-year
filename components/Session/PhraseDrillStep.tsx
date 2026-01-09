'use client';

import React, { useState } from 'react';
import { GradeStatus, type PhraseCard, type SessionStatus } from '@/lib/data/types';
import { type SimpleGradingResult } from '@/lib/ai/grading-utils';
import { Button } from '@/components/UI/Button';
import { LatinText } from '@/components/UI/LatinText';
import { GradingLoader } from '@/components/UI/GradingLoader';

interface PhraseDrillStepProps {
  phrase: PhraseCard;
  sessionId: string;
  itemIndex: number;
  onAdvance: (payload: { nextIndex: number; status: SessionStatus }) => void;
}

interface FeedbackState {
  grading: SimpleGradingResult;
  userInput: string;
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
      const res = await fetch('/api/phrase-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          itemIndex,
          phraseCardId: phrase.id,
          userInput: input,
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to grade translation');
      }

      const data = await res.json();
      setFeedback({ grading: data.grading, userInput: input });
      setAdvancePayload({ nextIndex: data.nextIndex ?? itemIndex + 1, status: data.status ?? 'active' });
    } catch (error) {
      console.error('Error submitting phrase drill', error);
      // Fallback: show error state
      setFeedback({
        grading: {
          status: GradeStatus.PARTIAL,
          feedback: "Couldn't check your translation. Compare with the expected answer.",
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

  const isCorrect = feedback?.grading.status === GradeStatus.CORRECT;
  const isPartial = feedback?.grading.status === GradeStatus.PARTIAL;

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
      <div className="text-center space-y-4">
        <span className="text-xs font-semibold tracking-eyebrow text-roman-500 uppercase">
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
          <GradingLoader />
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
            <p className="text-xs text-roman-500 uppercase tracking-eyebrow font-semibold">
              <LatinText latin="Tua Responsio" english="Your Answer" />
            </p>
            <p className="text-roman-800 italic">"{feedback.userInput}"</p>
          </div>

          {/* Correct answer */}
          <div className="bg-white/50 rounded-lg p-4 space-y-1">
            <p className="text-xs text-roman-500 uppercase tracking-eyebrow font-semibold">
              <LatinText latin="Responsio Vera" english="Correct Answer" />
            </p>
            <p className="font-medium text-roman-800">{phrase.english}</p>
          </div>

          {/* Hint if provided */}
          {feedback.grading.hint && (
            <div className="bg-pompeii-50 rounded-lg p-4 text-sm text-pompeii-800">
              <span className="font-bold">Hint: </span>
              {feedback.grading.hint}
            </div>
          )}

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
