'use client';

import React, { useState } from 'react';
import { GradeStatus, type Sentence, type GradingResult, type SessionStatus, type AttemptHistoryEntry, type ErrorType } from '@/lib/data/types';
import { Button } from '@/components/UI/Button';
import { LatinText } from '@/components/UI/LatinText';
import { AttemptHistory } from './AttemptHistory';
import { ErrorTypeIcon } from '@/components/UI/ErrorTypeIcon';

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
      <h2 className="text-3xl md:text-4xl font-serif text-roman-900 leading-tight">
        {words.map((word, i) => {
          if (/^\s+$/.test(word)) return <span key={i}>{word}</span>;
          const cleaned = cleanWord(word);
          const hasGloss = !!glossary[cleaned];
          const isSelected = selectedWord === cleaned;
          return (
            <span
              key={i}
              onClick={() => handleWordClick(word)}
              className={`${hasGloss ? 'cursor-pointer hover:text-pompeii-600 transition-colors' : ''} ${
                isSelected ? 'text-pompeii-600 underline decoration-pompeii-400' : ''
              }`}
            >
              {word}
            </span>
          );
        })}
      </h2>
    );
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
        // Laurel wreath
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
        // Balance scales
        return (
          <svg className={`${baseClass} text-terracotta-600`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <path d="M12 3v18" />
            <path d="M5 7l7-2 7 2" />
            <path d="M3 13l4-6 4 6a4 4 0 01-8 0z" />
            <path d="M13 13l4-6 4 6a4 4 0 01-8 0z" />
          </svg>
        );
      default:
        // Hollow circle (miss)
        return (
          <svg className={`${baseClass} text-iron-500`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
            <circle cx="12" cy="12" r="9" />
            <path d="M9 9l6 6M15 9l-6 6" />
          </svg>
        );
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
      <div className="text-center space-y-4">
        <span className="text-xs font-bold tracking-widest text-roman-500 uppercase">
          <LatinText latin="Recognitio" english="Review" />
        </span>
        {feedback ? renderInteractiveLatin() : (
          <h2 className="text-3xl md:text-4xl font-serif text-roman-900 leading-tight">{sentence.latin}</h2>
        )}
      </div>

      {/* Glossary popup */}
      {selectedWord && glossary[selectedWord] && (
        <div className="bg-roman-900 text-white p-3 rounded-lg text-sm shadow-lg text-center animate-bounce-in">
          <span className="font-medium">{selectedWord}</span>: {glossary[selectedWord]}
        </div>
      )}

      {!feedback ? (
        isSubmitting ? (
          /* Loading state - thoughtful AI grading messaging */
          <div className="rounded-lg bg-roman-50 border border-roman-200 p-8 text-center space-y-3 animate-fade-in">
            <p className="text-lg font-serif text-roman-700 animate-pulse">
              MAGISTER EXAMINAT...
            </p>
            <p className="text-sm text-roman-500">
              Your tutor is reviewing your translation
            </p>
            <div className="flex justify-center gap-1 pt-2">
              <span className="w-2 h-2 bg-roman-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
              <span className="w-2 h-2 bg-roman-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
              <span className="w-2 h-2 bg-roman-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <label className="block text-sm font-medium text-roman-700">
              <LatinText latin="Quid hoc significat?" english="What does this mean?" />
            </label>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-full p-4 border-roman-300 rounded-lg shadow-sm focus:ring-pompeii-500 focus:border-pompeii-500 text-lg font-sans min-h-[120px]"
              placeholder="Scribe interpretationem tuam..."
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
          {/* Status Badge - Inline with icon */}
          <div className="flex items-center gap-3">
            <StatusIcon status={feedback.result.status} />
            <span className={`text-xl font-serif font-bold ${getStatusTextColor(feedback.result.status)}`}>
              {feedback.result.status === GradeStatus.CORRECT ? 'Optime!' :
               feedback.result.status === GradeStatus.PARTIAL ? 'Paene.' : 'Non satis.'}
            </span>
          </div>

          {/* User Translation - Clean with subtle left accent */}
          <div>
            <p className="text-xs uppercase tracking-wide font-bold text-roman-500 mb-2">
              <LatinText latin="Tua Interpretatio" english="Your Translation" />
            </p>
            <p className="text-lg text-roman-800 italic border-l-2 border-roman-300 pl-4">
              "{feedback.userInput}"
            </p>
          </div>

          {/* Reference Translation - Status-colored accent */}
          {feedback.result.correction && (
            <div>
              <p className="text-xs uppercase tracking-wide font-bold text-roman-500 mb-2">
                <LatinText latin="Sensus Verus" english="Correct Translation" />
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
              <summary className="cursor-pointer text-xs text-roman-500 uppercase tracking-wide font-bold list-none flex items-center gap-2">
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
                    <span className="text-pompeii-600 shrink-0 mt-0.5">
                      <ErrorTypeIcon type={error.type as ErrorType} className="w-5 h-5" />
                    </span>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs font-bold uppercase text-roman-500">{error.type.replace('_', ' ')}</span>
                        {error.latinSegment && (
                          <span className="font-serif font-medium text-roman-900">"{error.latinSegment}"</span>
                        )}
                      </div>
                      <span className="text-roman-700">{error.explanation}</span>
                    </div>
                  </li>
                ))}
              </ul>
            </details>
          )}

          {/* Glossary hint */}
          {Object.keys(glossary).length > 0 && (
            <p className="text-xs text-roman-500 italic">
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
  );
};
