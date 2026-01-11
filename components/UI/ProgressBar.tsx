import React from 'react';

interface ProgressBarProps {
  current: number;
  total: number;
}

export const ProgressBar: React.FC<ProgressBarProps> = ({ current, total }) => {
  const percentage = Math.min((current / total) * 100, 100);

  return (
    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden" aria-label="Session progress">
      <div className="bg-tyrian-600 h-full transition-all duration-500 ease-out" style={{ width: `${percentage}%` }} />
    </div>
  );
};
