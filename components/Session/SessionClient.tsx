'use client';

import React, { useState } from 'react';
import type { SessionItem, SessionStatus } from '@/lib/data/types';
import { useRouter } from 'next/navigation';
import { ProgressBar } from '@/components/ui/ProgressBar';
import { ReviewStep } from '@/components/session/ReviewStep';
import { ReadingStep } from '@/components/session/ReadingStep';

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
      ) : (
        <ReadingStep
          key={item.reading.id}
          reading={item.reading}
          sessionId={sessionId}
          itemIndex={currentIndex}
          onAdvance={handleAdvance}
        />
      )}
    </div>
  );
};

