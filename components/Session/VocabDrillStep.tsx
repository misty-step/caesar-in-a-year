'use client';

import React, { useState } from 'react';
import { GradeStatus, type VocabCard, type SessionStatus } from '@/lib/data/types';
import { Button } from '@/components/UI/Button';
import { LatinText } from '@/components/UI/LatinText';

interface VocabDrillStepProps {
  vocab: VocabCard;
  sessionId: string;
  itemIndex: number;
  onAdvance: (payload: { nextIndex: number; status: SessionStatus }) => void;
}

interface FeedbackState {
  isCorrect: boolean;
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
      // Simple string comparison for vocab drills (case-insensitive, trimmed)
      const userAnswer = input.trim().toLowerCase();
      const correctAnswer = vocab.answer.trim().toLowerCase();

      // Allow some flexibility - check if user answer contains the key part
      const isCorrect =
        userAnswer === correctAnswer ||
        correctAnswer.includes(userAnswer) ||
        userAnswer.includes(correctAnswer);

      // Call API to record the vocab review and update FSRS
      const res = await fetch('/api/vocab-review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          itemIndex,
          vocabCardId: vocab.id,
          userInput: input,
          isCorrect,
        }),
      });

      if (!res.ok) {
        console.error('Failed to record vocab review');
      }

      const data = await res.json();
      setFeedback({ isCorrect, userInput: input });
      setAdvancePayload({ nextIndex: data.nextIndex ?? itemIndex + 1, status: data.status ?? 'active' });
    } catch (error) {
      console.error('Error submitting vocab drill', error);
      // Even on error, show feedback based on local comparison
      const isCorrect = input.trim().toLowerCase() === vocab.answer.trim().toLowerCase();
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

  const getQuestionLabel = () => {
    switch (vocab.questionType) {
      case 'latin_to_english':
        return { latin: 'Quid significat?', english: 'What does it mean?' };
      case 'form_identification':
        return { latin: 'Quae forma est?', english: 'What form is this?' };
      case 'context_fill':
        return { latin: 'Comple sententiam', english: 'Fill in the blank' };
      default:
        return { latin: 'Responde', english: 'Answer' };
    }
  };

  const label = getQuestionLabel();

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
            <p className="font-medium text-roman-800">{vocab.answer}</p>
          </div>

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
