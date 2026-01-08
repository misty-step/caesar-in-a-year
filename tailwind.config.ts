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
        // Status colors - Roman thematic
        laurel: {
          50: '#fdfcf3',   // light gold bg
          100: '#f9f5e3',
          500: '#C9B037',  // laurel gold
          700: '#8a7726',  // dark gold
        },
        terracotta: {
          50: '#fdf6f4',   // light terracotta bg
          100: '#fae8e3',
          500: '#E2725B',  // terracotta
          700: '#b85a47',  // dark terracotta
        },
        iron: {
          50: '#f5f5f5',   // light grey bg
          100: '#e8e8e9',
          500: '#48494B',  // iron grey
          700: '#2d2e30',  // dark iron
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
