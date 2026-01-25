'use client';

import React, { useState } from 'react';
import { GradeStatus, type ReadingPassage, type GradingResult, type SessionStatus, type ErrorType } from '@/lib/data/types';
import { Button } from '@/components/UI/Button';
import { LatinText } from '@/components/UI/LatinText';
import { Label } from '@/components/UI/Label';
import { Card } from '@/components/UI/Card';
import { GradingLoader } from '@/components/UI/GradingLoader';
import { ErrorTypeIcon } from '@/components/UI/ErrorTypeIcon';
import { cn } from '@/lib/design';

interface ReadingStepProps {
  reading: ReadingPassage;
  sessionId: string;
  itemIndex: number;
  onAdvance: (payload: { nextIndex: number; status: SessionStatus }) => void;
}

interface FeedbackState {
  result: GradingResult;
  userInput: string;
}

/**
 * Reading step for comprehension exercises.
 *
 * State machine: INPUT -> SUBMITTING -> FEEDBACK -> [advance]
 * Glossary source: static reading.glossary before feedback, AI-derived after.
 * See docs/architecture/session-flow.md for full state diagram.
 *
 * Uses semantic tokens throughout:
 * - Card component for passage container
 * - text-text-primary/secondary/muted for text hierarchy
 * - text-success/warning for status colors
 * - bg-accent for selected glossary words
 */
export const ReadingStep: React.FC<ReadingStepProps> = ({ reading, sessionId, itemIndex, onAdvance }) => {
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [advancePayload, setAdvancePayload] = useState<{ nextIndex: number; status: SessionStatus } | null>(null);

  // Clean word for glossary lookup (remove punctuation)
  const cleanWord = (word: string) => word.replace(/[.,;:!?'\"()\[\]{}]/g, '').toLowerCase();

  // Get active glossary: AI-derived after grading, static before
  const aiGlossary = (feedback?.result.analysis?.glossary ?? []).reduce<Record<string, string>>(
    (acc, { word, meaning }) => ({ ...acc, [word.toLowerCase()]: meaning }),
    {}
  );
  const activeGlossary = feedback ? aiGlossary : reading.glossary;

  const handleWordClick = (word: string) => {
    const cleaned = cleanWord(word);
    if (activeGlossary[cleaned]) {
      setSelectedWord(selectedWord === cleaned ? null : cleaned);
    }
  };

  const handleSubmit = async () => {
    if (!input.trim() || isSubmitting) return;
    setIsSubmitting(true);

    try {
      const res = await fetch('/api/grade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          itemIndex,
          userInput: input,
          tzOffsetMin: new Date().getTimezoneOffset(),
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to grade reading gist');
      }

      const data = (await res.json()) as {
        result: GradingResult;
        userInput: string;
        nextIndex: number;
        status: SessionStatus;
      };

      setFeedback({ result: data.result, userInput: data.userInput });
      setAdvancePayload({ nextIndex: data.nextIndex, status: data.status });
    } catch (error) {
      console.error('Error grading reading gist', error);
      setFeedback({
        result: {
          status: GradeStatus.PARTIAL,
          feedback:
            'We could not reach the tutor right now. Compare your summary with the reference gist and continue.',
          correction: reading.referenceGist,
        },
        userInput: input,
      });
      setAdvancePayload(null);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleComplete = () => {
    if (advancePayload) {
      onAdvance(advancePayload);
    }
    setFeedback(null);
    setInput('');
    setSelectedWord(null);
  };

  const getStatusTextColor = (status: GradeStatus) => {
    switch (status) {
      case GradeStatus.CORRECT:
        return 'text-success';
      case GradeStatus.PARTIAL:
        return 'text-warning';
      default:
        return 'text-text-muted';
    }
  };

  const getMarginColor = (status: GradeStatus) => {
    switch (status) {
      case GradeStatus.CORRECT:
        return 'border-success bg-success-faint';
      case GradeStatus.PARTIAL:
        return 'border-warning bg-warning-faint';
      default:
        return 'border-text-muted bg-surface';
    }
  };

  // Status icon - simplified
  const StatusIcon = ({ status }: { status: GradeStatus }) => {
    const baseClass = "size-6";
    switch (status) {
      case GradeStatus.CORRECT:
        return (
          <svg className={cn(baseClass, 'text-success')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        );
      case GradeStatus.PARTIAL:
        return (
          <svg className={cn(baseClass, 'text-warning')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      default:
        return (
          <svg className={cn(baseClass, 'text-text-muted')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
    }
  };

  // Render passage with interactive words
  const renderPassage = () => (
    <div className="space-y-4 font-serif text-2xl md:text-3xl leading-relaxed text-text-primary">
      {reading.latinText.map((line, i) => (
        <p key={i}>
          {line.split(' ').map((word, wI) => {
            const cleaned = cleanWord(word);
            const hasGloss = !!activeGlossary[cleaned];
            const isSelected = selectedWord === cleaned;
            return (
              <span
                key={wI}
                onClick={() => handleWordClick(word)}
                className={cn(
                  'transition-colors duration-fast inline-block rounded px-0.5',
                  hasGloss && 'cursor-pointer',
                  isSelected
                    ? 'bg-accent text-white'
                    : hasGloss && 'hover:bg-surface border-b border-dotted border-border'
                )}
              >
                {word}
              </span>
            );
          })}
        </p>
      ))}
    </div>
  );

  return (
    <div className="max-w-3xl mx-auto space-y-8 animate-fade-in pb-20">
      {/* Header */}
      <div className="text-center space-y-2">
        <Label>
          <LatinText latin="Lectio Nova" english="New Reading" />
        </Label>
        <h2 className="text-2xl md:text-3xl font-serif text-text-primary">{reading.title}</h2>
      </div>

      {/* Passage card */}
      <Card elevation="flat" padding="lg" className="relative">
        {renderPassage()}

        {/* Glossary popup */}
        {selectedWord && activeGlossary[selectedWord] && (
          <div className="absolute bottom-4 left-8 right-8 bg-text-primary text-text-inverse p-3 rounded-lg text-sm shadow-lg text-center animate-bounce-in">
            <span className="font-medium italic mr-2">{selectedWord}:</span>
            {activeGlossary[selectedWord]}
          </div>
        )}
      </Card>

      {/* Glossary hint after feedback */}
      {feedback && Object.keys(aiGlossary).length > 0 && (
        <p className="text-xs text-text-muted italic text-center">
          Tap words in the Latin above to see their meanings.
        </p>
      )}

      <div className="space-y-4">
        {!feedback ? (
          isSubmitting ? (
            <GradingLoader />
          ) : (
            <>
              <div className="flex items-center space-x-2">
                <span className="bg-border text-text-secondary text-xs font-bold px-2 py-1 rounded-sm">
                  <LatinText latin="Pensum" english="Task" />
                </span>
                <p className="font-medium text-text-primary">{reading.gistQuestion}</p>
              </div>
              <textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handleSubmit();
                  }
                }}
                className={cn(
                  'w-full p-4 border border-border rounded-lg shadow-sm',
                  'focus:ring-2 focus:ring-accent focus:border-accent',
                  'font-sans min-h-[120px] bg-surface'
                )}
                placeholder="Explain the gist here..."
                aria-label="Your summary"
              />
              <div className="flex justify-end">
                <Button
                  onClick={handleSubmit}
                  disabled={!input.trim()}
                  labelLatin="Proba Intellectum"
                  labelEnglish="Verify Understanding"
                />
              </div>
            </>
          )
        ) : (
          <div className="space-y-6 animate-fade-in">
            {/* Scriptorium-style margin feedback */}
            <div className={cn('border-l-4 p-4 rounded-r-lg', getMarginColor(feedback.result.status))}>
              <div className="flex items-center gap-2 mb-3">
                <StatusIcon status={feedback.result.status} />
                <span className={cn('text-lg font-serif font-medium', getStatusTextColor(feedback.result.status))}>
                  <LatinText
                    latin={feedback.result.status === GradeStatus.CORRECT ? 'Optime!' :
                           feedback.result.status === GradeStatus.PARTIAL ? 'Paene.' : 'Non satis.'}
                    english={feedback.result.status === GradeStatus.CORRECT ? 'Excellent!' :
                             feedback.result.status === GradeStatus.PARTIAL ? 'Almost.' : 'Not enough.'}
                  />
                </span>
              </div>

              {/* Your summary */}
              <div className="mb-4">
                <p className="text-xs text-text-muted uppercase tracking-[0.15em] mb-1">Your summary</p>
                <p className="text-text-primary italic font-serif">"{feedback.userInput}"</p>
              </div>

              {/* Correction */}
              {feedback.result.correction && (
                <div className="mb-4">
                  <p className="text-xs text-warning uppercase tracking-[0.15em] mb-1">Correct understanding</p>
                  <p className="text-text-primary font-serif">"{feedback.result.correction}"</p>
                </div>
              )}

              {/* Feedback prose */}
              <p className="text-text-secondary text-sm leading-relaxed">{feedback.result.feedback}</p>
            </div>

            {/* Detailed errors - collapsible */}
            {feedback.result.analysis?.errors && feedback.result.analysis.errors.length > 0 && (
              <details className="group" open={feedback.result.status !== GradeStatus.CORRECT}>
                <summary className="cursor-pointer text-xs text-text-muted uppercase tracking-[0.15em] font-semibold list-none flex items-center gap-2">
                  <svg
                    className="size-4 transition-transform group-open:rotate-90"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <LatinText latin="Errores Specifici" english="Specific Errors" />
                  <span className="text-text-faint">({feedback.result.analysis.errors.length})</span>
                </summary>
                <ul className="mt-3 space-y-2">
                  {feedback.result.analysis.errors.map((error, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm bg-surface rounded-lg p-3">
                      <span className="text-warning shrink-0 mt-0.5">
                        <ErrorTypeIcon type={error.type as ErrorType} className="size-5" />
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold uppercase text-text-muted">{error.type.replace('_', ' ')}</span>
                          {error.latinSegment && (
                            <span className="font-serif font-medium text-text-primary">"{error.latinSegment}"</span>
                          )}
                        </div>
                        <span className="text-text-secondary">{error.explanation}</span>
                      </div>
                    </li>
                  ))}
                </ul>
              </details>
            )}

            <div className="pt-4 flex justify-end">
              <Button onClick={handleComplete} labelLatin="Finire Lectionem" labelEnglish="Finish Lesson" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
