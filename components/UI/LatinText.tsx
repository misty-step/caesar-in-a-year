'use client';

import React, { useState, useEffect } from 'react';

interface LatinTextProps {
  latin: string;
  english: string;
  className?: string;
  /**
   * 'inline': standard span behavior
   * 'block': div behavior
   */
  variant?: 'inline' | 'block';
  /**
   * 'tooltip': Hover/Click to reveal (Good for static text)
   * 'cycle': Automatically cross-fades between Latin and English (Good for Buttons on mobile)
   */
  interaction?: 'tooltip' | 'cycle';
  inverted?: boolean;
}

export const LatinText: React.FC<LatinTextProps> = ({
  latin,
  english,
  className = '',
  variant = 'inline',
  interaction = 'tooltip',
  inverted = false,
}) => {
  const [isHovered, setIsHovered] = useState(false);
  const [cycleShowEnglish, setCycleShowEnglish] = useState(false);

  useEffect(() => {
    if (interaction !== 'cycle') return;

    const interval = setInterval(() => {
      if (!isHovered) {
        setCycleShowEnglish((prev) => !prev);
      }
    }, cycleShowEnglish ? 3000 : 6000);

    return () => clearInterval(interval);
  }, [interaction, cycleShowEnglish, isHovered]);

  const Tag = variant === 'block' ? 'div' : 'span';

  if (interaction === 'cycle') {
    const showEnglish = isHovered || cycleShowEnglish;

    return (
      <Tag
        className={`relative inline-flex items-center justify-center ${className}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onTouchStart={() => setIsHovered(true)}
        onTouchEnd={() => setIsHovered(false)}
      >
        <span className="invisible select-none font-bold" aria-hidden="true" title={latin}>
          {latin.length > english.length ? latin : english}
        </span>

        <span
          className={`absolute inset-0 flex items-center justify-center transition-opacity duration-[1500ms] ease-in-out ${
            showEnglish ? 'opacity-0' : 'opacity-100'
          }`}
        >
          {latin}
        </span>

        <span
          className={`absolute inset-0 flex items-center justify-center transition-opacity duration-[1500ms] ease-in-out ${
            showEnglish ? 'opacity-100' : 'opacity-0'
          }`}
        >
          {english}
        </span>
      </Tag>
    );
  }

  return (
    <Tag
      className={`relative cursor-help group inline-block ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        setIsHovered(!isHovered);
      }}
    >
      <span
        className={`transition-all duration-300 border-b border-dotted ${
          inverted ? 'border-white/30 group-hover:border-white/80' : 'border-roman-300 group-hover:border-pompeii-500'
        }`}
      >
        {latin}
      </span>

      <span
        className={`
          absolute left-1/2 -translate-x-1/2 bottom-full mb-2 
          px-3 py-1.5 bg-roman-900 text-white text-xs font-sans rounded shadow-lg whitespace-nowrap z-50 pointer-events-none
          transition-all duration-300 ease-out origin-bottom
          ${isHovered ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-2'}
        `}
        style={{ maxWidth: '200px', whiteSpace: 'normal', textAlign: 'center', width: 'max-content' }}
      >
        {english}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-roman-900"></span>
      </span>
    </Tag>
  );
};
