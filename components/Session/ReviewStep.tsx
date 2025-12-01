import React, { useState } from 'react';
import { Sentence, GradingResult, GradeStatus } from '../../types';
import { gradeTranslation } from '../../services/geminiService';
import { Button } from '../UI/Button';
import { LatinText } from '../UI/LatinText';

interface ReviewStepProps {
  sentence: Sentence;
  onComplete: () => void;
}

export const ReviewStep: React.FC<ReviewStepProps> = ({ sentence, onComplete }) => {
  const [input, setInput] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<GradingResult | null>(null);

  const handleSubmit = async () => {
    if (!input.trim()) return;
    setIsSubmitting(true);
    const grading = await gradeTranslation(sentence.latin, input, sentence.referenceTranslation, sentence.context);
    setResult(grading);
    setIsSubmitting(false);
  };

  const handleContinue = () => {
    setResult(null);
    setInput('');
    onComplete();
  };

  return (
    <div className="max-w-2xl mx-auto space-y-8 animate-fade-in">
      <div className="text-center space-y-4">
        <span className="text-xs font-bold tracking-widest text-roman-500 uppercase">
          <LatinText latin="Recognitio" english="Review" />
        </span>
        <h2 className="text-3xl md:text-4xl font-serif text-roman-900 leading-tight">
          {sentence.latin}
        </h2>
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
            placeholder="Scribe interpretationem tuam..." // Type your translation...
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
        <div className={`rounded-lg p-6 border-l-4 space-y-4 ${
          result.status === GradeStatus.CORRECT ? 'bg-green-50 border-green-500' :
          result.status === GradeStatus.PARTIAL ? 'bg-yellow-50 border-yellow-500' :
          'bg-red-50 border-red-500'
        }`}>
          <div className="flex items-center space-x-2">
            <span className={`text-lg font-bold ${
              result.status === GradeStatus.CORRECT ? 'text-green-800' :
              result.status === GradeStatus.PARTIAL ? 'text-yellow-800' :
              'text-red-800'
            }`}>
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
            <Button 
              onClick={handleContinue}
              labelLatin="Perge"
              labelEnglish="Continue"
            />
          </div>
        </div>
      )}
    </div>
  );
};