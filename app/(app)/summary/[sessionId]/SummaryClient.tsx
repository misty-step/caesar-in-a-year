'use client';

import { useEffect } from 'react';
import { SummaryCard } from '@/components/Session/SummaryCard';
import { showToast } from '@/components/UI/Toast';
import type { Session } from '@/lib/data/types';

interface SummaryClientProps {
  session: Session;
  levelUpParam?: string;
}

export function SummaryClient({ session, levelUpParam }: SummaryClientProps) {
  useEffect(() => {
    if (levelUpParam) {
      const [oldLevelStr, newLevelStr] = levelUpParam.split('-');
      const oldLevel = parseInt(oldLevelStr, 10);
      const newLevel = parseInt(newLevelStr, 10);
      if (!isNaN(oldLevel) && !isNaN(newLevel)) {
        showToast(`Level ${oldLevel} → ${newLevel}. Bene factum!`);
      }
    }
  }, [levelUpParam]);

  return <SummaryCard session={session} />;
}
