import type { Config } from 'tailwindcss';

/**
 * Kinetic Codex Tailwind Configuration
 *
 * This config extends Tailwind with semantic design tokens.
 * Primary tokens are defined in globals.css via @theme directive.
 * This file provides additional utilities and backward compatibility.
 */

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // =================================================================
        // SEMANTIC COLORS (Primary Interface)
        // These map to CSS variables defined in globals.css
        // =================================================================

        // Backgrounds
        background: 'var(--color-background)',
        surface: {
          DEFAULT: 'var(--color-surface)',
          hover: 'var(--color-surface-hover)',
        },

        // Text
        'text-primary': 'var(--color-text-primary)',
        'text-secondary': 'var(--color-text-secondary)',
        'text-muted': 'var(--color-text-muted)',
        'text-faint': 'var(--color-text-faint)',
        'text-inverse': 'var(--color-text-inverse)',

        // Interactive (Rubric)
        accent: {
          DEFAULT: 'var(--color-accent)',
          hover: 'var(--color-accent-hover)',
          light: 'var(--color-accent-light)',
          faint: 'var(--color-accent-faint)',
        },

        // Borders
        border: {
          DEFAULT: 'var(--color-border)',
          subtle: 'var(--color-border-subtle)',
        },

        // Focus
        'focus-ring': 'var(--color-focus-ring)',

        // Status
        success: {
          DEFAULT: 'var(--color-success)',
          light: 'var(--color-success-light)',
          faint: 'var(--color-success-faint)',
        },
        warning: {
          DEFAULT: 'var(--color-warning)',
          light: 'var(--color-warning-light)',
          faint: 'var(--color-warning-faint)',
        },
        celebration: {
          DEFAULT: 'var(--color-celebration)',
          light: 'var(--color-celebration-light)',
          faint: 'var(--color-celebration-faint)',
        },
        achievement: {
          DEFAULT: 'var(--color-achievement)',
          light: 'var(--color-achievement-light)',
          faint: 'var(--color-achievement-faint)',
        },

        // Heatmap (Data Visualization)
        heatmap: {
          0: 'var(--color-heatmap-0)',
          1: 'var(--color-heatmap-1)',
          2: 'var(--color-heatmap-2)',
          3: 'var(--color-heatmap-3)',
          4: 'var(--color-heatmap-4)',
        },

        // =================================================================
        // LEGACY COLORS (Backward Compatibility)
        // Keep existing component code working during migration
        // TODO: Remove after full migration to semantic tokens
        // =================================================================

        // Map old names to new semantic tokens
        parchment: {
          DEFAULT: 'var(--color-background)',
          warm: 'var(--color-surface)',
          cool: 'var(--color-surface-hover)',
        },
        ink: {
          DEFAULT: 'var(--color-text-primary)',
          light: 'var(--color-text-secondary)',
          muted: 'var(--color-text-muted)',
          faint: 'var(--color-text-faint)',
        },
        // Tyrian → Accent (Rubric)
        tyrian: {
          500: 'var(--color-accent)',
          600: 'var(--color-accent-hover)',
        },
        // Status colors (keep names for compatibility)
        laurel: {
          DEFAULT: 'var(--color-success)',
          500: 'var(--color-success)',
          400: 'var(--color-success-light)',
        },
        terracotta: {
          DEFAULT: 'var(--color-warning)',
          500: 'var(--color-warning)',
          400: 'var(--color-warning-light)',
        },
        verdigris: {
          DEFAULT: 'var(--color-celebration)',
          500: 'var(--color-celebration)',
          400: 'var(--color-celebration-light)',
        },
        bronze: {
          DEFAULT: 'var(--color-achievement)',
          500: 'var(--color-achievement)',
          400: 'var(--color-achievement-light)',
        },
        // Slate scale (neutral fallback)
        slate: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          800: '#262626',
          900: '#171717',
          950: '#0a0a0a',
        },
      },

      fontFamily: {
        // Kinetic Codex Typography
        display: ['var(--font-display)', 'Fraunces', 'serif'],
        serif: ['var(--font-serif)', 'Crimson Pro', 'serif'],
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },

      fontSize: {
        // Editorial type scale - tight tracking for serif
        'display-xl': [
          '4.5rem',
          { lineHeight: '1.05', letterSpacing: '-0.04em', fontWeight: '600' },
        ],
        'display-lg': [
          '3.5rem',
          { lineHeight: '1.1', letterSpacing: '-0.03em', fontWeight: '600' },
        ],
        'display-md': [
          '2.5rem',
          { lineHeight: '1.15', letterSpacing: '-0.02em', fontWeight: '600' },
        ],
        'display-sm': [
          '1.875rem',
          { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '600' },
        ],
        // Grammar metadata
        grammar: [
          '0.625rem',
          { lineHeight: '1', letterSpacing: '0.1em', fontWeight: '500' },
        ],
      },

      letterSpacing: {
        eyebrow: '0.15em',
        tight: '-0.02em',
        tighter: '-0.03em',
      },

      borderRadius: {
        // Editorial: sharp corners for pages, subtle rounding for interactive
        page: '2px',
        card: '4px',
      },

      backgroundImage: {
        // Subtle radial gradient from rubric
        aurora:
          'radial-gradient(ellipse 100% 60% at 50% -10%, var(--color-accent-faint), transparent)',
        // Paper texture
        paper:
          "url(\"data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)' opacity='0.03'/%3E%3C/svg%3E\")",
      },

      boxShadow: {
        soft: '0 1px 2px rgba(0,0,0,0.04)',
        card: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.08)',
        'glow-accent': '0 0 20px var(--color-accent-faint)',
        // Legacy alias
        'glow-tyrian': '0 0 20px var(--color-accent-faint)',
      },

      transitionTimingFunction: {
        ink: 'var(--ease-ink)',
        spring: 'var(--ease-spring)',
        'out-expo': 'var(--ease-out-expo)',
      },

      transitionDuration: {
        instant: 'var(--duration-instant)',
        fast: 'var(--duration-fast)',
        normal: 'var(--duration-normal)',
        slow: 'var(--duration-slow)',
      },

      animation: {
        'fade-in': 'fade-in 0.4s var(--ease-out-expo)',
        'fade-in-up': 'fade-in-up 0.5s var(--ease-out-expo)',
        'fade-in-delay': 'fade-in 0.4s var(--ease-out-expo) 0.15s both',
        'fade-in-delay-2': 'fade-in 0.4s var(--ease-out-expo) 0.3s both',
        'scale-in': 'scale-in 0.25s var(--ease-out-expo)',
        'bounce-in': 'bounce-in 0.3s var(--ease-spring)',
        stamp: 'stamp 150ms var(--ease-out-expo)',
        'ink-reveal': 'ink-reveal 0.4s var(--ease-ink)',
        'ink-flow': 'ink-flow 0.6s var(--ease-ink)',
        'rubric-pulse': 'rubric-pulse 2s var(--ease-ink) infinite',
      },
    },
  },
  plugins: [],
};

export default config;
