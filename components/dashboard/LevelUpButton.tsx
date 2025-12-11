'use client';

import { useMutation } from 'convex/react';
import { api } from '@/convex/_generated/api';
import { Button } from '@/components/UI/Button';
import { useState } from 'react';

interface LevelUpButtonProps {
  userId: string;
  currentDifficulty: number;
}

const MAX_DIFFICULTY = 100;

export function LevelUpButton({ userId, currentDifficulty }: LevelUpButtonProps) {
  const incrementDifficulty = useMutation(api.userProgress.incrementDifficulty);
  const [isLoading, setIsLoading] = useState(false);

  const isMaxed = currentDifficulty >= MAX_DIFFICULTY;

  const handleLevelUp = async () => {
    setIsLoading(true);
    try {
      await incrementDifficulty({ userId, increment: 5 });
    } finally {
      setIsLoading(false);
    }
  };

  if (isMaxed) {
    return (
      <p className="text-sm text-roman-600 italic">
        All content unlocked!
      </p>
    );
  }

  return (
    <Button
      onClick={handleLevelUp}
      disabled={isLoading}
      labelLatin="Auge Difficultatem"
      labelEnglish={isLoading ? 'Unlocking...' : 'Unlock Harder Content'}
      className="text-sm"
    />
  );
}
