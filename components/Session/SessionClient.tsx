'use client';

import React, { useState } from 'react';
import type { SessionItem, SessionStatus } from '@/lib/data/types';
import { useRouter } from 'next/navigation';
import { ProgressBar } from '@/components/UI/ProgressBar';
import { ReviewStep } from '@/components/Session/ReviewStep';
import { ReadingStep } from '@/components/Session/ReadingStep';
import { VocabDrillStep } from '@/components/Session/VocabDrillStep';

interface SessionClientProps {
  sessionId: string;
  items: SessionItem[];
  initialIndex: number;
  initialStatus: SessionStatus;
}

export const SessionClient: React.FC<SessionClientProps> = ({
  sessionId,
  items,
  initialIndex,
  initialStatus,
}) => {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [status, setStatus] = useState<SessionStatus>(initialStatus);

  const total = items.length;
  const item = items[currentIndex];

  const handleAdvance = ({ nextIndex, status: nextStatus }: { nextIndex: number; status: SessionStatus }) => {
    setCurrentIndex(nextIndex);
    setStatus(nextStatus);

    if (nextStatus === 'complete') {
      router.push(`/summary/${sessionId}`);
    }
  };

  if (!item) {
    return null;
  }

  return (
    <div className="space-y-8">
      <div className="pt-4">
        <ProgressBar current={currentIndex + 1} total={total} />
      </div>

      {item.type === 'REVIEW' ? (
        <ReviewStep
          key={item.sentence.id}
          sentence={item.sentence}
          sessionId={sessionId}
          itemIndex={currentIndex}
          onAdvance={handleAdvance}
        />
      ) : item.type === 'NEW_READING' ? (
        <ReadingStep
          key={item.reading.id}
          reading={item.reading}
          sessionId={sessionId}
          itemIndex={currentIndex}
          onAdvance={handleAdvance}
        />
      ) : (
        <VocabDrillStep
          key={item.vocab.id}
          vocab={item.vocab}
          sessionId={sessionId}
          itemIndex={currentIndex}
          onAdvance={handleAdvance}
        />
      )}
    </div>
  );
};

