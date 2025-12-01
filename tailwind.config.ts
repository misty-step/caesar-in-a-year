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
        roman: {
          50: '#f9f7f5',
          100: '#efebe6',
          200: '#e0d8cf',
          300: '#cabbad',
          500: '#8c735a',
          700: '#5e4b3a',
          900: '#3a2d24',
        },
        pompeii: {
          500: '#b84232',
          600: '#963426',
        },
      },
      fontFamily: {
        sans: ['var(--font-sans)', 'Inter', 'system-ui', 'sans-serif'],
        serif: ['var(--font-serif)', 'Crimson Pro', 'serif'],
      },
    },
  },
  plugins: [],
};

export default config;
