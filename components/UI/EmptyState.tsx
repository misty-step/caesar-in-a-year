import Link from 'next/link';
import { LatinText } from './LatinText';

interface EmptyStateProps {
  /** Latin title with English fallback */
  titleLatin: string;
  titleEnglish: string;
  /** Optional description */
  description?: string;
  /** Call to action - one clear next action per ui-skills */
  action?: {
    labelLatin: string;
    labelEnglish: string;
    href: string;
  };
}

/**
 * Empty state component with one clear next action.
 * Per ui-skills: "MUST give empty states one clear next action."
 */
export function EmptyState({ titleLatin, titleEnglish, description, action }: EmptyStateProps) {
  return (
    <div className="text-center py-12 px-6">
      {/* Subtle decorative element */}
      <div className="w-12 h-12 mx-auto mb-4 rounded-full bg-slate-100 flex items-center justify-center">
        <svg
          className="w-6 h-6 text-ink-muted"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6.042A8.967 8.967 0 006 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 016 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 016-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0018 18a8.967 8.967 0 00-6 2.292m0-14.25v14.25"
          />
        </svg>
      </div>

      <p className="font-serif text-lg text-ink mb-2">
        <LatinText latin={titleLatin} english={titleEnglish} />
      </p>

      {description && (
        <p className="text-sm text-ink-muted max-w-xs mx-auto mb-6">{description}</p>
      )}

      {action && (
        <Link
          href={action.href}
          className="inline-flex items-center justify-center px-4 py-2 bg-tyrian-500 text-white font-medium rounded-card hover:bg-tyrian-600 transition-colors focus:outline-none focus:ring-2 focus:ring-tyrian-500 focus:ring-offset-2"
        >
          <LatinText latin={action.labelLatin} english={action.labelEnglish} />
        </Link>
      )}
    </div>
  );
}
