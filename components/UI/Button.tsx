import React from 'react';
import { LatinText } from './LatinText';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost';
  isLoading?: boolean;
  /**
   * Provide both labels to enable the automatic "breathing" translation cycle.
   * This is preferred over passing children for text buttons.
   */
  labelLatin?: string;
  labelEnglish?: string;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = 'primary',
  className = '',
  isLoading,
  disabled,
  labelLatin,
  labelEnglish,
  ...props
}) => {
  const baseStyle =
    'inline-flex items-center justify-center px-6 py-3 text-sm font-medium rounded-card focus:outline-none focus-visible:ring-2 focus-visible:ring-tyrian-500 focus-visible:ring-offset-2 transition-all duration-200';

  const variants = {
    primary: 'text-white bg-tyrian-500 hover:bg-tyrian-600 active:scale-[0.98]',
    secondary: 'text-ink bg-slate-100 hover:bg-slate-200 active:scale-[0.98]',
    outline: 'border border-slate-300 text-ink-light bg-transparent hover:bg-slate-50 active:scale-[0.98]',
    ghost: 'text-ink-muted hover:text-ink bg-transparent',
  };

  return (
    <button
      className={`${baseStyle} ${variants[variant]} ${
        disabled || isLoading ? 'opacity-50 cursor-not-allowed' : ''
      } ${className}`}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading ? (
        <svg
          className="animate-spin -ml-1 mr-3 h-5 w-5 text-current"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
        >
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
      ) : null}

      {labelLatin && labelEnglish ? (
        <LatinText latin={labelLatin} english={labelEnglish} interaction="cycle" />
      ) : (
        children
      )}
    </button>
  );
};
