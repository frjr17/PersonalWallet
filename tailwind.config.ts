import type { Config } from 'tailwindcss';
export default {
  darkMode: ['class'],
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        oat: '#F7F2E8',
        ink: '#20302C',
        jade: '#176B5B',
        apricot: '#E98563',
        mist: '#DCE8E2',
      },
      fontFamily: {
        sans: ['Source Sans 3 Variable', 'sans-serif'],
        display: ['Sora', 'sans-serif'],
        mono: ['IBM Plex Mono Variable', 'monospace'],
      },
      boxShadow: { card: '0 1px 0 rgba(32,48,44,.08), 0 12px 30px rgba(32,48,44,.06)' },
    },
  },
  plugins: [],
} satisfies Config;
