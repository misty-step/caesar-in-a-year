'use client';

import React, { useState } from 'react';
import type { Sentence, GradingResult } from '@/types';
import { GradeStatus } from '@/types';
import type { SessionStatus } from '@/lib/data/types';
import { Button } from '@/components/UI/Button';
import { LatinText } from '@/components/UI/LatinText';

interface ReviewStepProps {
  sentence: Sentence;
  sessionId: string;
  itemIndex: number;
  onAdvance: (payload: { nextIndex: number; status: SessionStatus }) => void;
}

export const ReviewStep: React.FC<ReviewStepProps> = ({ sentence, sessionId, itemIndex, onAdvance }) => {
  const [input, setInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<GradingResult | null>(null);
  const [advancePayload, setAdvancePayload] = useState<{ nextIndex: number; status: SessionStatus } | null>(null);

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
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to grade translation');
      }

      const data = (await res.json()) as {
        result: GradingResult;
        nextIndex: number;
        status: SessionStatus;
      };

      setResult(data.result);
      setAdvancePayload({ nextIndex: data.nextIndex, status: data.status });
    } catch (error) {
      console.error('Error grading review sentence', error);
      setResult({
        status: GradeStatus.PARTIAL,
        feedback:
          'We could not reach the tutor right now. Compare your answer with the reference meaning and continue.',
        correction: sentence.referenceTranslation,
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
    setResult(null);
    setInput('');
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
      <div className="text-center space-y-4">
        <span className="text-xs font-bold tracking-widest text-roman-500 uppercase">
          <LatinText latin="Recognitio" english="Review" />
        </span>
        <h2 className="text-3xl md:text-4xl font-serif text-roman-900 leading-tight">{sentence.latin}</h2>
      </div>

      {!result ? (
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
        <div
          className={`rounded-lg p-6 border-l-4 space-y-4 ${
            result.status === GradeStatus.CORRECT
              ? 'bg-green-50 border-green-500'
              : result.status === GradeStatus.PARTIAL
              ? 'bg-yellow-50 border-yellow-500'
              : 'bg-red-50 border-red-500'
          }`}
        >
          <div className="flex items-center space-x-2">
            <span
              className={`text-lg font-bold ${
                result.status === GradeStatus.CORRECT
                  ? 'text-green-800'
                  : result.status === GradeStatus.PARTIAL
                  ? 'text-yellow-800'
                  : 'text-red-800'
              }`}
            >
              {result.status === GradeStatus.CORRECT ? (
                <LatinText latin="Optime!" english="Excellent!" />
              ) : result.status === GradeStatus.PARTIAL ? (
                <LatinText latin="Paene." english="Almost there." />
              ) : (
                <LatinText latin="Non satis." english="Not quite." />
              )}
            </span>
          </div>

          <p className="text-roman-900">{result.feedback}</p>

          {result.correction && (
            <div className="pt-2 border-t border-black/10">
              <p className="text-xs text-roman-500 uppercase tracking-wide">
                <LatinText latin="Sensus Verus" english="Reference Meaning" />
              </p>
              <p className="font-medium text-roman-800 italic">"{sentence.referenceTranslation}"</p>
            </div>
          )}

          <div className="pt-4 flex justify-end">
            <Button onClick={handleContinue} labelLatin="Perge" labelEnglish="Continue" />
          </div>
        </div>
      )}
    </div>
  );
};

*** Add File: components/Session/ReadingStep.tsx
'use client';

import React, { useState } from 'react';
import type { ReadingPassage, GradingResult } from '@/types';
import { GradeStatus } from '@/types';
import type { SessionStatus } from '@/lib/data/types';
import { Button } from '@/components/UI/Button';
import { LatinText } from '@/components/UI/LatinText';

interface ReadingStepProps {
  reading: ReadingPassage;
  sessionId: string;
  itemIndex: number;
  onAdvance: (payload: { nextIndex: number; status: SessionStatus }) => void;
}

export const ReadingStep: React.FC<ReadingStepProps> = ({ reading, sessionId, itemIndex, onAdvance }) => {
  const [selectedWord, setSelectedWord] = useState<string | null>(null);
  const [input, setInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<GradingResult | null>(null);
  const [advancePayload, setAdvancePayload] = useState<{ nextIndex: number; status: SessionStatus } | null>(null);

  const cleanWord = (word: string) => word.replace(/[.,;]/g, '').toLowerCase();

  const handleWordClick = (word: string) => {
    const cleaned = cleanWord(word);
    if (reading.glossary[cleaned]) {
      setSelectedWord(cleaned);
    } else {
      setSelectedWord(null);
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
        }),
      });

      if (!res.ok) {
        throw new Error('Failed to grade reading gist');
      }

      const data = (await res.json()) as {
        result: GradingResult;
        nextIndex: number;
        status: SessionStatus;
      };

      setResult(data.result);
      setAdvancePayload({ nextIndex: data.nextIndex, status: data.status });
    } catch (error) {
      console.error('Error grading reading gist', error);
      setResult({
        status: GradeStatus.PARTIAL,
        feedback:
          'We could not reach the tutor right now. Compare your summary with the reference gist and continue.',
        correction: reading.referenceGist,
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
  };

  return (
    <div className="max-w-3xl mx-auto space-y-10 animate-fade-in pb-20">
      <div className="text-center">
        <span className="text-xs font-bold tracking-widest text-roman-500 uppercase">
          <LatinText latin="Lectio Nova" english="New Reading" />
        </span>
        <h2 className="text-2xl font-serif text-roman-900 mt-2">{reading.title}</h2>
      </div>

      <div className="bg-white p-8 rounded-xl shadow-sm border border-roman-200 relative">
        <div className="space-y-4 font-serif text-2xl md:text-3xl leading-relaxed text-roman-900">
          {reading.latinText.map((line, i) => (
            <p key={i}>
              {line.split(' ').map((word, wI) => {
                const cleaned = cleanWord(word);
                const hasGloss = !!reading.glossary[cleaned];
                return (
                  <span
                    key={wI}
                    onClick={() => handleWordClick(word)}
                    className={`cursor-pointer transition-colors duration-150 inline-block mr-1.5 rounded px-1 -mx-1 ${
                      selectedWord === cleaned
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

        {selectedWord && (
          <div className="absolute bottom-4 left-8 right-8 bg-roman-900 text-white p-3 rounded-lg text-sm shadow-lg text-center animate-bounce-in">
            <span className="font-bold italic mr-2">{selectedWord}:</span>
            {reading.glossary[selectedWord]}
          </div>
        )}
      </div>

      <div className="space-y-4">
        {!result ? (
          <>
            <div className="flex items-center space-x-2">
              <span className="bg-roman-200 text-roman-700 text-xs font-bold px-2 py-1 rounded">
                <LatinText latin="Pensum" english="Task" />
              </span>
              <p className="font-medium text-roman-900">
                <LatinText
                  latin={reading.gistQuestion}
                  english="In your own words, describe how Gaul is structured according to this passage."
                />
              </p>
            </div>
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              className="w-full p-4 border-roman-300 rounded-lg shadow-sm focus:ring-pompeii-500 focus:border-pompeii-500 font-sans h-32"
              placeholder="Explica summam hic..."
            />
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
          <div
            className={`rounded-lg p-6 border-l-4 space-y-4 ${
              result.status === GradeStatus.CORRECT
                ? 'bg-green-50 border-green-500'
                : result.status === GradeStatus.PARTIAL
                ? 'bg-yellow-50 border-yellow-500'
                : 'bg-red-50 border-red-500'
            }`}
          >
            <h3 className="font-bold text-roman-900">
              <LatinText latin="Explicatio" english="Analysis" />
            </h3>
            <p className="text-roman-800">{result.feedback}</p>
            <div className="pt-4 flex justify-end">
              <Button onClick={handleComplete} labelLatin="Finire Lectionem" labelEnglish="Finish Lesson" />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

