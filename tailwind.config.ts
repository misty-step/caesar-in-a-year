import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './lib/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // "The Scriptorium" palette - Editorial Roman
        // A digital manuscript desk, not a game launcher

        // Backgrounds - aged paper, not sterile white
        parchment: {
          DEFAULT: '#f8f6f1',
          warm: '#faf8f4',
          cool: '#f5f4f0',
        },
        obsidian: '#0a0a0a',

        // Primary - Tyrian Purple (imperial authority)
        tyrian: {
          50: '#fdf4f8',
          100: '#fae8f0',
          200: '#f5d0e1',
          400: '#a84878',
          500: '#66023C', // Imperial purple - the color of senators
          600: '#520230',
          700: '#3d0124',
        },

        // Accent - Sienna (margin corrections, tutor's ink)
        sienna: {
          50: '#fdf6f3',
          100: '#fae9e2',
          400: '#c66a4a',
          500: '#8b2500', // Burnt sienna - manuscript corrections
          600: '#6e1d00',
          700: '#511500',
        },

        // Secondary - Bronze Gold (achievement, completion)
        bronze: {
          50: '#fdfaf3',
          100: '#f9f0db',
          400: '#d4b56a',
          500: '#C5A059',
          600: '#a8863d',
          700: '#8a6c2f',
        },

        // Electric accent - Verdigris (celebrations, correct answers)
        // Sparse usage: only on success moments
        verdigris: {
          50: '#ecfdfb',
          100: '#d1faf5',
          400: '#2dd4bf',
          500: '#00E0C6',
          600: '#0891b2',
          700: '#0e7490',
        },

        // Ink - Carbon blacks for text
        ink: {
          DEFAULT: '#1a1a1a',
          light: '#404040',
          muted: '#737373',
          faint: '#a3a3a3',
        },

        // Neutral - Slate scale (unified, no aliases)
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

        // Status colors - clear and bold
        laurel: {
          50: '#f0fdf4',
          100: '#dcfce7',
          400: '#4ade80',
          500: '#22c55e',
          600: '#16a34a',
          700: '#15803d',
        },
        terracotta: {
          50: '#fff7ed',
          100: '#ffedd5',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
        },
        iron: {
          50: '#f8fafc',
          100: '#f1f5f9',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
        },
      },
      fontFamily: {
        // Display: Fraunces - warm, distinctive, scholarly without Hollywood kitsch
        display: ['var(--font-display)', 'Fraunces', 'serif'],
        // Serif: Crimson Pro - elegant Latin text
        serif: ['var(--font-serif)', 'Crimson Pro', 'serif'],
        // Sans: Geist - Swiss precision for UI
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Editorial type scale - chiseled, tight tracking
        'display-xl': ['4.5rem', { lineHeight: '1.05', letterSpacing: '-0.04em', fontWeight: '600' }],
        'display-lg': ['3.5rem', { lineHeight: '1.1', letterSpacing: '-0.03em', fontWeight: '600' }],
        'display-md': ['2.5rem', { lineHeight: '1.15', letterSpacing: '-0.02em', fontWeight: '600' }],
        'display-sm': ['1.875rem', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '600' }],
        // Grammatical metadata - future Latin parsing
        'grammar': ['0.625rem', { lineHeight: '1', letterSpacing: '0.1em', fontWeight: '500' }],
      },
      letterSpacing: {
        eyebrow: '0.15em',
        tight: '-0.02em',
        tighter: '-0.03em',
      },
      borderRadius: {
        // Editorial: sharp corners for pages, subtle rounding for interactive
        'page': '2px',
        'card': '4px',
      },
      backgroundImage: {
        // Single subtle gradient - not four stacked layers
        'aurora': 'radial-gradient(ellipse 100% 60% at 50% -10%, rgba(102, 2, 60, 0.04), transparent)',
        // Paper texture hint
        'paper': 'url("data:image/svg+xml,%3Csvg viewBox=\'0 0 256 256\' xmlns=\'http://www.w3.org/2000/svg\'%3E%3Cfilter id=\'noise\'%3E%3CfeTurbulence type=\'fractalNoise\' baseFrequency=\'0.8\' numOctaves=\'4\' stitchTiles=\'stitch\'/%3E%3C/filter%3E%3Crect width=\'100%25\' height=\'100%25\' filter=\'url(%23noise)\' opacity=\'0.03\'/%3E%3C/svg%3E")',
      },
      boxShadow: {
        // Subtle, editorial shadows
        'soft': '0 1px 2px rgba(0,0,0,0.04)',
        'card': '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.08)',
        'glow-tyrian': '0 0 20px rgba(102, 2, 60, 0.15)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(16px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'bounce-in': {
          '0%': { opacity: '0', transform: 'scale(0.95)' },
          '70%': { transform: 'scale(1.02)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
        // Tactile stamp - quick, satisfying, for correct answers
        'stamp': {
          '0%': { opacity: '0', transform: 'scale(1.4)' },
          '100%': { opacity: '1', transform: 'scale(1)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.4s ease-out',
        'fade-in-up': 'fade-in-up 0.5s ease-out',
        'fade-in-delay': 'fade-in 0.4s ease-out 0.15s both',
        'fade-in-delay-2': 'fade-in 0.4s ease-out 0.3s both',
        'scale-in': 'scale-in 0.25s ease-out',
        'bounce-in': 'bounce-in 0.3s ease-out',
        'stamp': 'stamp 150ms ease-out',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
