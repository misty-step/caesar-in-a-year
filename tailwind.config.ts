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
        // "Marble & Glass" palette - Ancient Brutalism
        // Vercel meets the Vatican

        // Backgrounds
        obsidian: '#0a0a0a',
        marble: {
          DEFAULT: '#f4f2f0',
          warm: '#faf8f6',
          cold: '#f0f0f0',
        },

        // Primary - Imperial Crimson (vibrant, almost neon)
        crimson: {
          50: '#fff5f5',
          100: '#ffe0e0',
          400: '#ff5c5c',
          500: '#FF3333', // Hero crimson
          600: '#e62e2e',
          700: '#cc2929',
        },

        // Secondary - Bronze Gold (metallic, achievement-worthy)
        bronze: {
          50: '#fdfaf3',
          100: '#f9f0db',
          400: '#d4b56a',
          500: '#C5A059', // Core bronze
          600: '#a8863d',
          700: '#8a6c2f',
        },

        // Imperial Purple (mastery, prestige)
        imperial: {
          50: '#faf5ff',
          100: '#f3e8ff',
          400: '#a855f7',
          500: '#7c3aed',
          600: '#6d28d9',
          700: '#5b21b6',
          900: '#2e1065',
        },

        // Neutral - True blacks and whites, no muddy grays
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

        // Status colors - bold and clear
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

        // Legacy aliases for compatibility
        roman: {
          50: '#fafafa',
          100: '#f5f5f5',
          200: '#e5e5e5',
          300: '#d4d4d4',
          400: '#a3a3a3',
          500: '#737373',
          600: '#525252',
          700: '#404040',
          900: '#171717',
        },
        pompeii: {
          100: '#ffe0e0',
          500: '#FF3333',
          600: '#e62e2e',
        },
        tyrian: {
          50: '#faf5ff',
          100: '#f3e8ff',
          500: '#7c3aed',
          700: '#5b21b6',
        },
      },
      fontFamily: {
        // Display: Carved, monumental headlines
        display: ['var(--font-display)', 'Cinzel', 'serif'],
        // Serif: Elegant Latin text
        serif: ['var(--font-serif)', 'Crimson Pro', 'serif'],
        // Sans: Modern SaaS UI
        sans: ['var(--font-sans)', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Stripe-level type scale
        'display-xl': ['5rem', { lineHeight: '1', letterSpacing: '-0.02em', fontWeight: '600' }],
        'display-lg': ['4rem', { lineHeight: '1.1', letterSpacing: '-0.02em', fontWeight: '600' }],
        'display-md': ['3rem', { lineHeight: '1.15', letterSpacing: '-0.01em', fontWeight: '600' }],
        'display-sm': ['2.25rem', { lineHeight: '1.2', letterSpacing: '-0.01em', fontWeight: '600' }],
      },
      letterSpacing: {
        eyebrow: '0.2em',
        tight: '-0.02em',
        tighter: '-0.04em',
      },
      backgroundImage: {
        // Aurora gradients - imperial purple/gold
        'aurora': 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(124, 58, 237, 0.15), transparent)',
        'aurora-gold': 'radial-gradient(ellipse 80% 50% at 50% -20%, rgba(197, 160, 89, 0.12), transparent)',
        'aurora-crimson': 'radial-gradient(ellipse 60% 40% at 80% 0%, rgba(255, 51, 51, 0.08), transparent)',
        // Mesh gradient for hero
        'mesh-gradient': 'radial-gradient(at 40% 20%, rgba(124, 58, 237, 0.08) 0px, transparent 50%), radial-gradient(at 80% 0%, rgba(197, 160, 89, 0.1) 0px, transparent 50%), radial-gradient(at 0% 50%, rgba(255, 51, 51, 0.05) 0px, transparent 50%)',
      },
      boxShadow: {
        // Stripe-style elevation
        'glow': '0 0 20px rgba(255, 51, 51, 0.3)',
        'glow-bronze': '0 0 20px rgba(197, 160, 89, 0.3)',
        'glow-purple': '0 0 20px rgba(124, 58, 237, 0.3)',
        'brutal': '4px 4px 0 0 currentColor',
        'card': '0 1px 3px rgba(0,0,0,0.08), 0 1px 2px rgba(0,0,0,0.06)',
        'card-hover': '0 10px 40px rgba(0,0,0,0.12)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(24px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in': {
          from: { opacity: '0', transform: 'translateX(-100%)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'glow-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        'draw-line': {
          from: { strokeDashoffset: '1000' },
          to: { strokeDashoffset: '0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.5s ease-out',
        'fade-in-up': 'fade-in-up 0.6s ease-out',
        'fade-in-delay': 'fade-in 0.5s ease-out 0.2s both',
        'fade-in-delay-2': 'fade-in 0.5s ease-out 0.4s both',
        'slide-in': 'slide-in 0.4s ease-out',
        'scale-in': 'scale-in 0.3s ease-out',
        'glow-pulse': 'glow-pulse 2s ease-in-out infinite',
        'float': 'float 6s ease-in-out infinite',
        'draw-line': 'draw-line 2s ease-out forwards',
      },
      transitionTimingFunction: {
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};

export default config;
