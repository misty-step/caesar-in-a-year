'use client';

import React, { useState } from 'react';
import { GradeStatus, type Sentence, type GradingResult, type SessionStatus } from '@/lib/data/types';
import { Button } from '@/components/UI/Button';
import { LatinText } from '@/components/UI/LatinText';

interface ReviewStepProps {
  sentence: Sentence;
  sessionId: string;
  itemIndex: number;
  onAdvance: (payload: { nextIndex: number; status: SessionStatus }) => void;
}

interface FeedbackState {
  result: GradingResult;
  userInput: string;
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
      };

      setFeedback({ result: data.result, userInput: data.userInput });
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
              isLoading={isSubmitting}
              disabled={!input.trim()}
              labelLatin="Confirma Sensum"
              labelEnglish="Check Meaning"
            />
          </div>
        </div>
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

          {/* Glossary hint */}
          {Object.keys(glossary).length > 0 && (
            <p className="text-xs text-roman-500 italic">
              Tap words in the Latin above to see their meanings.
            </p>
          )}

          <div className="pt-4 flex justify-end">
            <Button onClick={handleContinue} labelLatin="Perge" labelEnglish="Continue" />
          </div>
        </div>
      )}
    </div>
  );
};
