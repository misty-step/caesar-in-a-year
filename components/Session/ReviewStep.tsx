'use client';

import React, { useState } from 'react';
import { GradeStatus, type Sentence, type GradingResult, type SessionStatus, type AttemptHistoryEntry, type ErrorType } from '@/lib/data/types';
import { Button } from '@/components/UI/Button';
import { LatinText } from '@/components/UI/LatinText';
import { Label } from '@/components/UI/Label';
import { GradingLoader } from '@/components/UI/GradingLoader';
import { AttemptHistory } from './AttemptHistory';
import { ErrorTypeIcon } from '@/components/UI/ErrorTypeIcon';
import { cn } from '@/lib/design';

interface ReviewStepProps {
  sentence: Sentence;
  sessionId: string;
  itemIndex: number;
  onAdvance: (payload: { nextIndex: number; status: SessionStatus }) => void;
}

interface FeedbackState {
  result: GradingResult;
  userInput: string;
  attemptHistory?: AttemptHistoryEntry[];
}

/**
 * Review step for translating Latin sentences.
 *
 * State machine: INPUT -> SUBMITTING -> FEEDBACK -> [advance]
 * Error handling: API failure produces fallback FEEDBACK with advancePayload=null.
 * See docs/architecture/session-flow.md for full state diagram.
 *
 * Uses semantic tokens throughout:
 * - text-text-primary/secondary/muted for text hierarchy
 * - text-celebration/warning for status colors
 * - bg-surface for cards and inputs
 * - border-border for form elements
 */
export const ReviewStep: React.FC<ReviewStepProps> = ({ sentence, sessionId, itemIndex, onAdvance }) => {
  const [input, setInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<FeedbackState | null>(null);
  const [advancePayload, setAdvancePayload] = useState<{ nextIndex: number; status: SessionStatus } | null>(null);
  const [selectedWord, setSelectedWord] = useState<string | null>(null);

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
        throw new Error('Failed to grade translation');
      }

      const data = (await res.json()) as {
        result: GradingResult;
        userInput: string;
        nextIndex: number;
        status: SessionStatus;
        attemptHistory?: AttemptHistoryEntry[];
      };

      setFeedback({ result: data.result, userInput: data.userInput, attemptHistory: data.attemptHistory });
      setAdvancePayload({ nextIndex: data.nextIndex, status: data.status });
    } catch (error) {
      console.error('Error grading review sentence', error);
      setFeedback({
        result: {
          status: GradeStatus.PARTIAL,
          feedback:
            'We could not reach the tutor right now. Compare your answer with the reference meaning and continue.',
          correction: sentence.referenceTranslation,
        },
        userInput: input,
      });
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
    setSelectedWord(null);
  };

  // Convert glossary array to map for lookup
  const glossary = (feedback?.result.analysis?.glossary ?? []).reduce<Record<string, string>>(
    (acc, { word, meaning }) => ({ ...acc, [word.toLowerCase()]: meaning }),
    {}
  );

  // Clean word for glossary lookup (remove punctuation)
  const cleanWord = (word: string) => word.replace(/[.,;:!?'"()[\]{}]/g, '').toLowerCase();

  // Handle word click for glossary
  const handleWordClick = (word: string) => {
    const cleaned = cleanWord(word);
    if (glossary[cleaned]) {
      setSelectedWord(selectedWord === cleaned ? null : cleaned);
    }
  };

  // Render interactive Latin with clickable words
  const renderInteractiveLatin = () => {
    const words = sentence.latin.split(/(\s+)/);
    return (
      <h2 className="text-3xl md:text-4xl font-serif text-text-primary leading-tight">
        {words.map((word, i) => {
          if (/^\s+$/.test(word)) return <span key={i}>{word}</span>;
          const cleaned = cleanWord(word);
          const hasGloss = !!glossary[cleaned];
          const isSelected = selectedWord === cleaned;
          return (
            <span
              key={i}
              onClick={() => handleWordClick(word)}
              className={cn(
                hasGloss && 'cursor-pointer hover:text-accent transition-colors',
                isSelected && 'text-accent underline decoration-accent-light'
              )}
            >
              {word}
            </span>
          );
        })}
      </h2>
    );
  };

  const getStatusColor = (status: GradeStatus) => {
    switch (status) {
      case GradeStatus.CORRECT:
        return 'text-celebration';
      case GradeStatus.PARTIAL:
        return 'text-warning';
      default:
        return 'text-text-muted';
    }
  };

  const getMarginColor = (status: GradeStatus) => {
    switch (status) {
      case GradeStatus.CORRECT:
        return 'border-celebration bg-celebration-faint';
      case GradeStatus.PARTIAL:
        return 'border-warning bg-warning-faint';
      default:
        return 'border-text-muted bg-surface';
    }
  };

  // Status icon - stamp animation on correct for tactile feedback
  const StatusIcon = ({ status }: { status: GradeStatus }) => {
    const baseClass = "size-6";
    switch (status) {
      case GradeStatus.CORRECT:
        return (
          <svg className={cn(baseClass, 'text-celebration animate-stamp')} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
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

  return (
    <div className="max-w-3xl mx-auto animate-fade-in">
      {/* Main content with margin for annotations */}
      <div className="relative">
        {/* Latin text - center stage */}
        <div className="text-center space-y-4 mb-8">
          <Label>
            <LatinText latin="Recognitio" english="Review" />
          </Label>
          {feedback ? renderInteractiveLatin() : (
            <h2 className="text-3xl md:text-4xl font-serif text-text-primary leading-tight">{sentence.latin}</h2>
          )}
        </div>

        {/* Glossary popup */}
        {selectedWord && glossary[selectedWord] && (
          <div className="bg-text-primary text-text-inverse p-3 rounded-lg text-sm shadow-lg text-center animate-bounce-in mb-6">
            <span className="font-medium">{selectedWord}</span>: {glossary[selectedWord]}
          </div>
        )}

        {!feedback ? (
          isSubmitting ? (
            <GradingLoader />
          ) : (
            <div className="space-y-4">
              <label className="block text-sm font-medium text-text-secondary">
                <LatinText latin="Quid hoc significat?" english="What does this mean?" />
              </label>
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
                  'text-lg font-sans min-h-[120px] bg-white'
                )}
                placeholder="Write your translation..."
                autoFocus
              />
              <div className="flex justify-end">
                <Button
                  onClick={handleSubmit}
                  disabled={!input.trim()}
                  labelLatin="Confirma Sensum"
                  labelEnglish="Check Meaning"
                />
              </div>
            </div>
          )
        ) : (
          <div className="space-y-6 animate-fade-in">
            {/* Scriptorium-style margin feedback */}
            <div className={cn('border-l-4 p-4 rounded-r-lg', getMarginColor(feedback.result.status))}>
              <div className="flex items-center gap-2 mb-3">
                <StatusIcon status={feedback.result.status} />
                <span className={cn('text-lg font-serif font-medium', getStatusColor(feedback.result.status))}>
                  <LatinText
                    latin={feedback.result.status === GradeStatus.CORRECT ? 'Optime!' :
                           feedback.result.status === GradeStatus.PARTIAL ? 'Paene.' : 'Non satis.'}
                    english={feedback.result.status === GradeStatus.CORRECT ? 'Excellent!' :
                             feedback.result.status === GradeStatus.PARTIAL ? 'Almost.' : 'Not enough.'}
                  />
                </span>
              </div>

              {/* Your translation - like a student's writing */}
              <div className="mb-4">
                <p className="text-xs text-text-muted uppercase tracking-[0.15em] mb-1">Your translation</p>
                <p className="text-text-primary italic font-serif">"{feedback.userInput}"</p>
              </div>

              {/* Correction - like a tutor's note in the margin */}
              {feedback.result.correction && (
                <div className="mb-4">
                  <p className="text-xs text-warning uppercase tracking-[0.15em] mb-1">Correction</p>
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

            {/* Glossary hint */}
            {Object.keys(glossary).length > 0 && (
              <p className="text-xs text-text-muted italic">
                Tap words in the Latin above to see their meanings.
              </p>
            )}

            {/* Attempt history */}
            {feedback.attemptHistory && feedback.attemptHistory.length > 0 && (
              <AttemptHistory history={feedback.attemptHistory} />
            )}

            <div className="pt-4 flex justify-end">
              <Button onClick={handleContinue} labelLatin="Perge" labelEnglish="Continue" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
