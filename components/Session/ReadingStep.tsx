'use client';

import React, { useState } from 'react';
import { GradeStatus, type ReadingPassage, type GradingResult, type SessionStatus, type ErrorType } from '@/lib/data/types';
import { Button } from '@/components/UI/Button';
import { LatinText } from '@/components/UI/LatinText';
import { Label } from '@/components/UI/Label';
import { GradingLoader } from '@/components/UI/GradingLoader';
import { ErrorTypeIcon } from '@/components/UI/ErrorTypeIcon';

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
        return 'text-laurel-700';
      case GradeStatus.PARTIAL:
        return 'text-terracotta-700';
      default:
        return 'text-iron-700';
    }
  };

  const getMarginColor = (status: GradeStatus) => {
    switch (status) {
      case GradeStatus.CORRECT:
        return 'border-laurel-500 bg-laurel-50';
      case GradeStatus.PARTIAL:
        return 'border-sienna-500 bg-sienna-50';
      default:
        return 'border-iron-500 bg-iron-50';
    }
  };

  // Status icon - simplified
  const StatusIcon = ({ status }: { status: GradeStatus }) => {
    const baseClass = "w-6 h-6";
    switch (status) {
      case GradeStatus.CORRECT:
        return (
          <svg className={`${baseClass} text-laurel-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        );
      case GradeStatus.PARTIAL:
        return (
          <svg className={`${baseClass} text-terracotta-600`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        );
      default:
        return (
          <svg className={`${baseClass} text-iron-500`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        );
    }
  };

  // Render passage with interactive words
  const renderPassage = () => (
    <div className="space-y-4 font-serif text-2xl md:text-3xl leading-relaxed text-ink">
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
                className={`transition-colors duration-150 inline-block mr-1.5 rounded px-1 -mx-1 ${
                  hasGloss ? 'cursor-pointer' : ''
                } ${
                  isSelected
                    ? 'bg-tyrian-600 text-white'
                    : hasGloss
                    ? 'hover:bg-slate-100 border-b border-dotted border-slate-400'
                    : ''
                }`}
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
        <h2 className="text-2xl md:text-3xl font-serif text-ink">{reading.title}</h2>
      </div>

      {/* Passage card */}
      <div className="bg-parchment p-8 rounded-card border border-slate-200 relative">
        {renderPassage()}

        {/* Glossary popup */}
        {selectedWord && activeGlossary[selectedWord] && (
          <div className="absolute bottom-4 left-8 right-8 bg-ink text-white p-3 rounded-card text-sm shadow-lg text-center animate-bounce-in">
            <span className="font-medium italic mr-2">{selectedWord}:</span>
            {activeGlossary[selectedWord]}
          </div>
        )}
      </div>

      {/* Glossary hint after feedback */}
      {feedback && Object.keys(aiGlossary).length > 0 && (
        <p className="text-xs text-ink-muted italic text-center">
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
                <span className="bg-slate-200 text-ink-light text-xs font-bold px-2 py-1 rounded-page">
                  <LatinText latin="Pensum" english="Task" />
                </span>
                <p className="font-medium text-ink">{reading.gistQuestion}</p>
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
                className="w-full p-4 border border-slate-300 rounded-card shadow-soft focus:ring-2 focus:ring-tyrian-500 focus:border-tyrian-500 font-sans min-h-[120px] bg-white"
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
            <div className={`border-l-4 ${getMarginColor(feedback.result.status)} p-4 rounded-r-card`}>
              <div className="flex items-center gap-2 mb-3">
                <StatusIcon status={feedback.result.status} />
                <span className={`text-lg font-serif font-medium ${getStatusTextColor(feedback.result.status)}`}>
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
                <p className="text-xs text-ink-muted uppercase tracking-eyebrow mb-1">Your summary</p>
                <p className="text-ink italic font-serif">"{feedback.userInput}"</p>
              </div>

              {/* Correction */}
              {feedback.result.correction && (
                <div className="mb-4">
                  <p className="text-xs text-sienna-600 uppercase tracking-eyebrow mb-1">Correct understanding</p>
                  <p className="text-ink font-serif">"{feedback.result.correction}"</p>
                </div>
              )}

              {/* Feedback prose */}
              <p className="text-ink-light text-sm leading-relaxed">{feedback.result.feedback}</p>
            </div>

            {/* Detailed errors - collapsible */}
            {feedback.result.analysis?.errors && feedback.result.analysis.errors.length > 0 && (
              <details className="group" open={feedback.result.status !== GradeStatus.CORRECT}>
                <summary className="cursor-pointer text-xs text-ink-muted uppercase tracking-eyebrow font-semibold list-none flex items-center gap-2">
                  <svg
                    className="w-4 h-4 transition-transform group-open:rotate-90"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <LatinText latin="Errores Specifici" english="Specific Errors" />
                  <span className="text-ink-faint">({feedback.result.analysis.errors.length})</span>
                </summary>
                <ul className="mt-3 space-y-2">
                  {feedback.result.analysis.errors.map((error, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm bg-slate-50 rounded-card p-3">
                      <span className="text-sienna-600 shrink-0 mt-0.5">
                        <ErrorTypeIcon type={error.type as ErrorType} className="w-5 h-5" />
                      </span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold uppercase text-ink-muted">{error.type.replace('_', ' ')}</span>
                          {error.latinSegment && (
                            <span className="font-serif font-medium text-ink">"{error.latinSegment}"</span>
                          )}
                        </div>
                        <span className="text-ink-light">{error.explanation}</span>
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
