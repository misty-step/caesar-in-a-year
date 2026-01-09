'use client';

import React, { useState } from 'react';
import { GradeStatus, type ReadingPassage, type GradingResult, type SessionStatus } from '@/lib/data/types';
import { Button } from '@/components/UI/Button';
import { LatinText } from '@/components/UI/LatinText';
import { GradingLoader } from '@/components/UI/GradingLoader';

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

  const getAccentColor = (status: GradeStatus) => {
    switch (status) {
      case GradeStatus.CORRECT:
        return 'border-laurel-500';
      case GradeStatus.PARTIAL:
        return 'border-terracotta-500';
      default:
        return 'border-iron-500';
    }
  };

  // Status icon component - Roman themed
  const StatusIcon = ({ status }: { status: GradeStatus }) => {
    const baseClass = "w-8 h-8";
    switch (status) {
      case GradeStatus.CORRECT:
        return (
          <svg className={`${baseClass} text-laurel-600`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 3c-1.5 2-2 4-2 6s.5 4 2 6c1.5-2 2-4 2-6s-.5-4-2-6z" />
            <path d="M6 6c1 2 3 3 5 3M18 6c-1 2-3 3-5 3" />
            <path d="M4 10c1.5 1.5 3.5 2 6 2M20 10c-1.5 1.5-3.5 2-6 2" />
            <path d="M3 15c2 1 4.5 1.5 7 1M21 15c-2 1-4.5 1.5-7 1" />
            <path d="M5 19c2 .5 4.5.5 7 0M19 19c-2 .5-4.5.5-7 0" />
          </svg>
        );
      case GradeStatus.PARTIAL:
        return (
          <svg className={`${baseClass} text-terracotta-600`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 3v18" />
            <path d="M5 7l7-2 7 2" />
            <path d="M3 13l4-6 4 6a4 4 0 01-8 0z" />
            <path d="M13 13l4-6 4 6a4 4 0 01-8 0z" />
          </svg>
        );
      default:
        return (
          <svg className={`${baseClass} text-iron-500`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="9" />
            <path d="M9 9l6 6M15 9l-6 6" />
          </svg>
        );
    }
  };

  // Render passage with interactive words
  const renderPassage = () => (
    <div className="space-y-4 font-serif text-2xl md:text-3xl leading-relaxed text-roman-900">
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
                    ? 'bg-pompeii-600 text-white'
                    : hasGloss
                    ? 'hover:bg-roman-100 border-b border-dotted border-roman-300'
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
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in pb-20">
      <div className="text-center">
        <span className="text-xs font-semibold tracking-eyebrow text-roman-500 uppercase">
          <LatinText latin="Lectio Nova" english="New Reading" />
        </span>
        <h2 className="text-2xl font-serif text-roman-900 mt-2">{reading.title}</h2>
      </div>

      <div className="bg-marble p-8 rounded-xl border border-roman-200 relative">
        {renderPassage()}

        {/* Glossary popup */}
        {selectedWord && activeGlossary[selectedWord] && (
          <div className="absolute bottom-4 left-8 right-8 bg-roman-900 text-white p-3 rounded-lg text-sm shadow-lg text-center animate-bounce-in">
            <span className="font-bold italic mr-2">{selectedWord}:</span>
            {activeGlossary[selectedWord]}
          </div>
        )}
      </div>

      {/* Glossary hint after feedback */}
      {feedback && Object.keys(aiGlossary).length > 0 && (
        <p className="text-xs text-roman-500 italic text-center">
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
                <span className="bg-roman-200 text-roman-700 text-xs font-bold px-2 py-1 rounded">
                  <LatinText latin="Pensum" english="Task" />
                </span>
                <p className="font-medium text-roman-900">{reading.gistQuestion}</p>
              </div>
              <div className="relative">
                <textarea
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  className="w-full p-4 border-roman-300 rounded-lg shadow-sm focus:ring-pompeii-500 focus:border-pompeii-500 font-sans h-32"
                  placeholder=""
                  aria-label="Your summary"
                />
                {!input && (
                  <div className="absolute top-4 left-4 pointer-events-none text-roman-400">
                    <LatinText latin="Explica summam hic..." english="Explain the gist here..." />
                  </div>
                )}
              </div>
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
            {/* Status Badge - Inline with icon */}
            <div className="flex items-center gap-3">
              <StatusIcon status={feedback.result.status} />
              <span className={`text-xl font-serif font-bold ${getStatusTextColor(feedback.result.status)}`}>
                <LatinText
                  latin={feedback.result.status === GradeStatus.CORRECT ? 'Optime!' :
                         feedback.result.status === GradeStatus.PARTIAL ? 'Paene.' : 'Non satis.'}
                  english={feedback.result.status === GradeStatus.CORRECT ? 'Excellent!' :
                           feedback.result.status === GradeStatus.PARTIAL ? 'Almost.' : 'Not enough.'}
                />
              </span>
            </div>

            {/* User's answer - Clean with subtle left accent */}
            <div>
              <p className="text-xs uppercase tracking-eyebrow font-semibold text-roman-500 mb-2">
                <LatinText latin="Tua Responsio" english="Your Answer" />
              </p>
              <p className="text-lg text-roman-800 italic border-l-2 border-roman-300 pl-4">
                "{feedback.userInput}"
              </p>
            </div>

            {/* Reference gist - Status-colored accent */}
            {feedback.result.correction && (
              <div>
                <p className="text-xs uppercase tracking-eyebrow font-semibold text-roman-500 mb-2">
                  <LatinText latin="Summa Vera" english="Correct Understanding" />
                </p>
                <p className={`text-lg text-roman-900 border-l-2 pl-4 ${getAccentColor(feedback.result.status)}`}>
                  "{feedback.result.correction}"
                </p>
              </div>
            )}

            {/* Separator */}
            <div className="border-t border-roman-200" />

            {/* Feedback - Full width prose */}
            <p className="text-roman-800">{feedback.result.feedback}</p>

            {/* Detailed errors - collapsible */}
            {feedback.result.analysis?.errors && feedback.result.analysis.errors.length > 0 && (
              <details className="group" open={feedback.result.status !== GradeStatus.CORRECT}>
                <summary className="cursor-pointer text-xs text-roman-500 uppercase tracking-eyebrow font-semibold list-none flex items-center gap-2">
                  <svg
                    className="w-4 h-4 transition-transform group-open:rotate-90"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                  <LatinText latin="Errores Specifici" english="Specific Errors" />
                  <span className="text-roman-400">({feedback.result.analysis.errors.length})</span>
                </summary>
                <ul className="mt-3 space-y-2">
                  {feedback.result.analysis.errors.map((error, i) => (
                    <li key={i} className="flex items-start gap-3 text-sm bg-roman-50 rounded-lg p-3">
                      <span className="text-pompeii-500 font-bold shrink-0">✗</span>
                      <div>
                        {error.latinSegment && (
                          <span className="font-medium text-roman-900">"{error.latinSegment}"</span>
                        )}
                        <span className="text-roman-700"> — {error.explanation}</span>
                        <span className="text-xs text-roman-500 ml-2">({error.type})</span>
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

