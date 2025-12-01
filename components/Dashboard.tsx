import React from 'react';
import { Button } from './UI/Button';
import { UserProgress } from '../types';
import { LatinText } from './UI/LatinText';

interface DashboardProps {
  progress: UserProgress;
  onStartSession: () => void;
}

export const Dashboard: React.FC<DashboardProps> = ({ progress, onStartSession }) => {
  return (
    <div className="max-w-3xl mx-auto space-y-12 py-12">
      <div className="text-center space-y-4">
        <h2 className="text-4xl font-serif text-roman-900">
          <LatinText latin="Salve, Discipule." english="Hello, Student." />
        </h2>
        <div className="text-lg text-roman-600 max-w-lg mx-auto italic">
          <LatinText 
            latin="Iter ad Bella Gallica longum est, sed passibus legionis conficitur." 
            english="The journey to the Gallic Wars is long, but finished by the steps of the legion."
            variant="block"
          />
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-roman-200 p-8 flex flex-col md:flex-row items-center justify-between gap-8">
        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-roman-500">
            <LatinText latin="Progressus Hodiernus" english="Current Progress" />
          </span>
          <h3 className="text-2xl font-bold text-roman-900">
            <LatinText latin={`Dies ${progress.currentDay} ex CCCLXV`} english={`Day ${progress.currentDay} of 365`} />
          </h3>
          <p className="text-sm text-roman-600">
            <LatinText latin="Phasis I: Fundamenta" english="Phase 1: Foundations" />
          </p>
        </div>

        <div className="flex flex-col items-center"> 
           <div className="text-4xl font-serif text-pompeii-600 mb-1">{progress.streak}</div>
           <span className="text-xs uppercase text-roman-400 font-bold">
             <LatinText latin="Series Dierum" english="Day Streak" />
           </span>
        </div>

        <div>
          <Button 
            onClick={onStartSession} 
            className="w-full md:w-auto text-lg px-8 py-4 shadow-md group"
            labelLatin="Perge Iter"
            labelEnglish="Continue Journey"
          />
        </div>
      </div>
    </div>
  );
};
