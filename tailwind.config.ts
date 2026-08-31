import type { Config } from 'tailwindcss';

/**
 * Design tokens transcribed from the approved Bursary-Bridge reference screens.
 * The purple-forward palette, radii and shadow scale below are the visual
 * source of truth for the whole application.
 */
const config: Config = {
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#F4F2FE',
          100: '#EBE6FD',
          200: '#D9CFFB',
          300: '#BEACF7',
          400: '#9E80F2',
          500: '#8055EA',
          600: '#5B2EDB', // primary action colour
          700: '#4A22BC',
          800: '#3B1B96',
          900: '#2C1471',
        },
        ink: {
          DEFAULT: '#12132B', // headings
          700: '#2E3050',
          600: '#4A4C6B',
          500: '#6B6D88',
          400: '#8A8CA6',
          300: '#A9ABBF',
        },
        surface: {
          DEFAULT: '#FFFFFF',
          muted: '#F8F8FC',
          subtle: '#F4F4F9',
        },
        line: {
          DEFAULT: '#E8E8F0',
          strong: '#D8D8E4',
        },
        sidebar: {
          DEFAULT: '#12132B',
          hover: '#1E1F3D',
          active: '#5B2EDB',
          text: '#A9ABC4',
        },
        success: {
          50: '#E9F9EF',
          100: '#D2F3DE',
          600: '#12874A',
          700: '#0D6B3A',
        },
        warning: {
          50: '#FFF6E5',
          100: '#FFECCC',
          600: '#B26A00',
          700: '#8A5200',
        },
        danger: {
          50: '#FEECEC',
          100: '#FDD8D8',
          600: '#C42B2B',
          700: '#9E2020',
        },
        info: {
          50: '#EAF2FE',
          100: '#D5E5FD',
          600: '#1D63C9',
          700: '#17509F',
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
      },
      borderRadius: {
        card: '14px',
        panel: '16px',
        field: '10px',
        btn: '10px',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgba(18, 19, 43, 0.04), 0 1px 3px 0 rgba(18, 19, 43, 0.04)',
        elevated: '0 4px 16px -2px rgba(18, 19, 43, 0.08), 0 2px 6px -2px rgba(18, 19, 43, 0.05)',
        float: '0 12px 32px -8px rgba(18, 19, 43, 0.16)',
        focus: '0 0 0 3px rgba(91, 46, 219, 0.16)',
      },
      maxWidth: {
        shell: '1240px',
        form: '640px',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 180ms ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
