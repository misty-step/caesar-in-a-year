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
  inverted?: boolean; // For light text on dark backgrounds (buttons)
}

export const LatinText: React.FC<LatinTextProps> = ({ 
  latin, 
  english, 
  className = '', 
  variant = 'inline',
  interaction = 'tooltip',
  inverted = false
}) => {
  const [isHovered, setIsHovered] = useState(false);
  
  // State for Cycle Mode
  const [cycleShowEnglish, setCycleShowEnglish] = useState(false);

  useEffect(() => {
    if (interaction !== 'cycle') return;

    // Cycle logic: Show Latin for 6s, English for 3s
    // This creates a slow, "breathing" rhythm
    const interval = setInterval(() => {
      if (!isHovered) {
        setCycleShowEnglish(prev => !prev);
      }
    }, cycleShowEnglish ? 3000 : 6000);

    return () => clearInterval(interval);
  }, [interaction, cycleShowEnglish, isHovered]);

  const Tag = variant === 'block' ? 'div' : 'span';

  // --- CYCLE MODE (For Buttons) ---
  if (interaction === 'cycle') {
    // If hovered, force English. Otherwise follow cycle state.
    const showEnglish = isHovered || cycleShowEnglish;

    return (
      <Tag 
        className={`relative inline-flex items-center justify-center ${className}`}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onTouchStart={() => setIsHovered(true)}
        onTouchEnd={() => setIsHovered(false)}
      >
        {/* 
           Layout Hack: Render both strings invisibly to force the container 
           to take the width/height of the widest/tallest text.
           This prevents the button from "jumping" when text changes.
        */}
        <span className="invisible select-none font-bold" aria-hidden="true" title={latin}>
           {latin.length > english.length ? latin : english}
        </span>

        {/* Latin Layer */}
        <span 
          className={`absolute inset-0 flex items-center justify-center transition-opacity duration-[1500ms] ease-in-out ${showEnglish ? 'opacity-0' : 'opacity-100'}`}
        >
          {latin}
        </span>

        {/* English Layer */}
        <span 
          className={`absolute inset-0 flex items-center justify-center transition-opacity duration-[1500ms] ease-in-out ${showEnglish ? 'opacity-100' : 'opacity-0'}`}
        >
          {english}
        </span>
      </Tag>
    );
  }

  // --- TOOLTIP MODE (For Static Text) ---
  return (
    <Tag
      className={`relative cursor-help group inline-block ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={(e) => { e.stopPropagation(); setIsHovered(!isHovered); }}
    >
      <span className={`transition-all duration-300 border-b border-dotted ${
        inverted 
          ? 'border-white/30 group-hover:border-white/80' 
          : 'border-roman-300 group-hover:border-pompeii-500'
      }`}>
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
        {/* Triangle arrow */}
        <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-roman-900"></span>
      </span>
    </Tag>
  );
};