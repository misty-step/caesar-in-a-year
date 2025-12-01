import React, { useState } from 'react';
import { Layout } from './components/Layout';
import { Dashboard } from './components/Dashboard';
import { ReviewStep } from './components/Session/ReviewStep';
import { ReadingStep } from './components/Session/ReadingStep';
import { ProgressBar } from './components/Session/ProgressBar';
import { Button } from './components/UI/Button';
import { LatinText } from './components/UI/LatinText';
import { REVIEW_SENTENCES, DAILY_READING } from './constants';
import { SegmentType, SessionItem, UserProgress } from './types';

// Simple View Router
enum View {
  DASHBOARD = 'DASHBOARD',
  SESSION = 'SESSION',
  SUMMARY = 'SUMMARY'
}

const App: React.FC = () => {
  const [view, setView] = useState<View>(View.DASHBOARD);
  const [sessionQueue, setSessionQueue] = useState<SessionItem[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  // Mock Progress - Reset to Day 1 / 0 XP / 0 Streak for fresh experience
  const [progress] = useState<UserProgress>({
    currentDay: 1,
    totalXp: 0,
    streak: 0,
    unlockedPhase: 1
  });

  const startSession = () => {
    // Build Session: 3 Reviews + 1 New Reading
    const items: SessionItem[] = [
      ...REVIEW_SENTENCES.map(s => ({ type: SegmentType.REVIEW, sentence: s })),
      { type: SegmentType.NEW_READING, reading: DAILY_READING }
    ];
    setSessionQueue(items);
    setCurrentIndex(0);
    setView(View.SESSION);
  };

  const handleNext = () => {
    if (currentIndex < sessionQueue.length - 1) {
      setCurrentIndex(prev => prev + 1);
    } else {
      setView(View.SUMMARY);
    }
  };

  const currentItem = sessionQueue[currentIndex];

  const renderSession = () => {
    if (!currentItem) return null;

    return (
      <div className="max-w-3xl mx-auto">
        <div className="mb-8">
          <div className="flex justify-between text-xs text-roman-500 mb-2 font-bold uppercase tracking-wider">
            <span>
              <LatinText latin="Progressus Sessionis" english="Session Progress" />
            </span>
            <span>{currentIndex + 1} / {sessionQueue.length}</span>
          </div>
          <ProgressBar current={currentIndex + 1} total={sessionQueue.length} />
        </div>

        {currentItem.type === SegmentType.REVIEW && currentItem.sentence && (
          <ReviewStep 
            key={currentItem.sentence.id} // Ensure remount on change
            sentence={currentItem.sentence} 
            onComplete={handleNext} 
          />
        )}

        {currentItem.type === SegmentType.NEW_READING && currentItem.reading && (
          <ReadingStep 
            key={currentItem.reading.id}
            reading={currentItem.reading} 
            onComplete={handleNext} 
          />
        )}
      </div>
    );
  };

  const renderSummary = () => (
    <div className="max-w-2xl mx-auto text-center space-y-8 py-12 animate-fade-in">
      <div className="w-20 h-20 bg-green-100 text-green-600 rounded-full flex items-center justify-center mx-auto text-4xl mb-6">
        ✓
      </div>
      <h2 className="text-4xl font-serif text-roman-900">
        <LatinText latin="Sessio Confecta" english="Session Complete" />
      </h2>
      <p className="text-lg text-roman-600 italic">
        <LatinText 
          latin={`Sententias recensuisti et novam lectionem de Gallia reseravisti.`}
          english={`You have reviewed ${REVIEW_SENTENCES.length} sentences and unlocked a new passage about Gaul.`} 
        />
      </p>
      <div className="bg-white p-6 rounded-lg border border-roman-200 shadow-sm max-w-sm mx-auto">
         <div className="text-sm text-roman-500 uppercase font-bold tracking-widest mb-1">
           <LatinText latin="Progressus Totalis" english="Total Progress" />
         </div>
         <div className="text-3xl font-serif text-pompeii-600">0.3%</div>
         <div className="text-xs text-roman-400 mt-2">
           <LatinText latin="ad Bellum Gallicum" english="to De Bello Gallico" />
         </div>
      </div>
      <Button 
        onClick={() => setView(View.DASHBOARD)}
        labelLatin="Redi Domum"
        labelEnglish="Return Home"
      />
    </div>
  );

  return (
    <Layout>
      {view === View.DASHBOARD && (
        <Dashboard progress={progress} onStartSession={startSession} />
      )}
      {view === View.SESSION && renderSession()}
      {view === View.SUMMARY && renderSummary()}
    </Layout>
  );
};

export default App;