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

  const getStatusColor = (status: GradeStatus) => {
    switch (status) {
      case GradeStatus.CORRECT:
        return 'bg-laurel-50 border-laurel-500';
      case GradeStatus.PARTIAL:
        return 'bg-terracotta-50 border-terracotta-500';
      default:
        return 'bg-iron-50 border-iron-500';
    }
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
        <div className={`rounded-lg p-6 border-l-4 space-y-5 ${getStatusColor(feedback.result.status)}`}>
          {/* Status header */}
          <div className="flex items-center space-x-2">
            <span className={`text-lg font-bold ${getStatusTextColor(feedback.result.status)}`}>
              {feedback.result.status === GradeStatus.CORRECT ? (
                <LatinText latin="Optime!" english="Excellent!" />
              ) : feedback.result.status === GradeStatus.PARTIAL ? (
                <LatinText latin="Paene." english="Almost there." />
              ) : (
                <LatinText latin="Non satis." english="Not quite." />
              )}
            </span>
          </div>

          {/* User's attempt */}
          <div className="bg-white/50 rounded-lg p-4 space-y-1">
            <p className="text-xs text-roman-500 uppercase tracking-wide font-bold">
              <LatinText latin="Tua Interpretatio" english="Your Translation" />
            </p>
            <p className="text-roman-800 italic">"{feedback.userInput}"</p>
            {feedback.result.analysis?.userTranslationLiteral && (
              <p className="text-xs text-roman-600 mt-1">
                (Literally: {feedback.result.analysis.userTranslationLiteral})
              </p>
            )}
          </div>

          {/* Reference translation */}
          {feedback.result.correction && (
            <div className="bg-white/50 rounded-lg p-4 space-y-1">
              <p className="text-xs text-roman-500 uppercase tracking-wide font-bold">
                <LatinText latin="Sensus Verus" english="Correct Translation" />
              </p>
              <p className="font-medium text-roman-800 italic">"{feedback.result.correction}"</p>
            </div>
          )}

          {/* Feedback summary */}
          <p className="text-roman-900">{feedback.result.feedback}</p>

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
                  <li key={i} className="flex items-start gap-3 text-sm bg-white/30 rounded-lg p-2">
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
