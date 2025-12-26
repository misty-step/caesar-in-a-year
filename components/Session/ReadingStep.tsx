'use client';

import React, { useState } from 'react';
import { GradeStatus, type ReadingPassage, type GradingResult, type SessionStatus } from '@/lib/data/types';
import { Button } from '@/components/UI/Button';
import { LatinText } from '@/components/UI/LatinText';

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

  const getStatusColor = (status: GradeStatus) => {
    switch (status) {
      case GradeStatus.CORRECT:
        return 'bg-green-50 border-green-500';
      case GradeStatus.PARTIAL:
        return 'bg-yellow-50 border-yellow-500';
      default:
        return 'bg-red-50 border-red-500';
    }
  };

  const getStatusTextColor = (status: GradeStatus) => {
    switch (status) {
      case GradeStatus.CORRECT:
        return 'text-green-800';
      case GradeStatus.PARTIAL:
        return 'text-yellow-800';
      default:
        return 'text-red-800';
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
    <div className="max-w-3xl mx-auto space-y-10 animate-fade-in pb-20">
      <div className="text-center">
        <span className="text-xs font-bold tracking-widest text-roman-500 uppercase">
          <LatinText latin="Lectio Nova" english="New Reading" />
        </span>
        <h2 className="text-2xl font-serif text-roman-900 mt-2">{reading.title}</h2>
      </div>

      <div className="bg-white p-8 rounded-xl shadow-sm border border-roman-200 relative">
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
                isLoading={isSubmitting}
                disabled={!input.trim()}
                labelLatin="Proba Intellectum"
                labelEnglish="Verify Understanding"
              />
            </div>
          </>
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

            {/* User's answer */}
            <div className="bg-white/50 rounded-lg p-4 space-y-1">
              <p className="text-xs text-roman-500 uppercase tracking-wide font-bold">
                <LatinText latin="Tua Responsio" english="Your Answer" />
              </p>
              <p className="text-roman-800 italic">"{feedback.userInput}"</p>
              {feedback.result.analysis?.userTranslationLiteral && (
                <p className="text-xs text-roman-600 mt-1">
                  (Implies: {feedback.result.analysis.userTranslationLiteral})
                </p>
              )}
            </div>

            {/* Reference gist */}
            {feedback.result.correction && (
              <div className="bg-white/50 rounded-lg p-4 space-y-1">
                <p className="text-xs text-roman-500 uppercase tracking-wide font-bold">
                  <LatinText latin="Summa Vera" english="Correct Understanding" />
                </p>
                <p className="font-medium text-roman-800 italic">"{feedback.result.correction}"</p>
              </div>
            )}

            {/* Feedback summary */}
            <p className="text-roman-900">{feedback.result.feedback}</p>

            {/* Detailed errors */}
            {feedback.result.analysis?.errors && feedback.result.analysis.errors.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs text-roman-500 uppercase tracking-wide font-bold">
                  <LatinText latin="Errores Specifici" english="Specific Errors" />
                </p>
                <ul className="space-y-2">
                  {feedback.result.analysis.errors.map((error, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="text-red-600 font-bold">✗</span>
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
              </div>
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

