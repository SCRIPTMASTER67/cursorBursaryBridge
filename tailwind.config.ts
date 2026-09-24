import type { Config } from 'tailwindcss';

/**
 * The Bursary-Bridge theme.
 *
 * Colours are not written here. They live once in `styles/globals.css` as
 * channel triplets and are referenced below, so changing a token there
 * re-themes every page, component, badge and chart in the application without
 * anything else being touched. The `<alpha-value>` placeholder is what keeps
 * Tailwind's opacity modifiers (`bg-brand-600/10`) working through a variable.
 *
 * The radii, shadows and type scale are transcribed from the approved
 * reference screens: rounded cards, softly rounded controls, and shadows tinted
 * with the brand's own dark teal rather than neutral black, which is what stops
 * a white card on cream looking grey.
 */

const token = (name: string) => `rgb(var(--${name}) / <alpha-value>)`;

const config: Config = {
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}', './lib/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Primary: the deep teal green of the sidebar and the hero.
        brand: {
          50: token('brand-50'),
          100: token('brand-100'),
          200: token('brand-200'),
          300: token('brand-300'),
          400: token('brand-400'),
          500: token('brand-500'),
          600: token('brand-600'), // primary action colour
          700: token('brand-700'),
          800: token('brand-800'),
          900: token('brand-900'),
          950: token('brand-950'),
        },
        // Accent: the coral used for calls-to-action and highlights.
        accent: {
          50: token('accent-50'),
          100: token('accent-100'),
          200: token('accent-200'),
          300: token('accent-300'),
          400: token('accent-400'),
          500: token('accent-500'),
          600: token('accent-600'),
          700: token('accent-700'),
        },
        ink: {
          DEFAULT: token('ink'),
          700: token('ink-700'),
          600: token('ink-600'),
          500: token('ink-500'),
          400: token('ink-400'),
          300: token('ink-300'),
        },
        surface: {
          DEFAULT: token('surface'),
          muted: token('surface-muted'),
          subtle: token('surface-subtle'),
          cream: token('surface-cream'),
        },
        line: {
          DEFAULT: token('line'),
          strong: token('line-strong'),
        },
        sidebar: {
          DEFAULT: token('sidebar'),
          hover: token('sidebar-hover'),
          active: token('sidebar-active'),
          text: token('sidebar-text'),
        },
        success: {
          50: token('success-50'),
          100: token('success-100'),
          600: token('success-600'),
          700: token('success-700'),
        },
        warning: {
          50: token('warning-50'),
          100: token('warning-100'),
          600: token('warning-600'),
          700: token('warning-700'),
        },
        danger: {
          50: token('danger-50'),
          100: token('danger-100'),
          600: token('danger-600'),
          700: token('danger-700'),
        },
        info: {
          50: token('info-50'),
          100: token('info-100'),
          600: token('info-600'),
          700: token('info-700'),
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        '2xs': ['0.6875rem', { lineHeight: '1rem' }],
        // The display size for the landing hero, which needs to hold its own
        // against a full-bleed photograph.
        display: [
          'clamp(2.5rem, 1.6rem + 3.6vw, 4rem)',
          { lineHeight: '1.04', letterSpacing: '-0.03em' },
        ],
      },
      borderRadius: {
        card: '16px',
        panel: '20px',
        field: '10px',
        btn: '12px',
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(1 37 39 / 0.04), 0 1px 3px 0 rgb(1 37 39 / 0.05)',
        elevated: '0 4px 16px -2px rgb(1 37 39 / 0.09), 0 2px 6px -2px rgb(1 37 39 / 0.06)',
        float: '0 12px 32px -8px rgb(1 37 39 / 0.18)',
        lift: '0 16px 36px -12px rgb(1 37 39 / 0.22)',
        focus: '0 0 0 3px rgb(6 95 79 / 0.16)',
      },
      maxWidth: {
        shell: '1240px',
        form: '640px',
      },
      transitionTimingFunction: {
        // A single easing curve for entrances, so nothing in the product moves
        // to a different rhythm from anything else.
        entrance: 'cubic-bezier(0.22, 1, 0.36, 1)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'rise-in': {
          from: { opacity: '0', transform: 'translateY(18px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'scale-in': {
          from: { opacity: '0', transform: 'scale(0.97)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'draw-rule': {
          from: { transform: 'scaleX(0)' },
          to: { transform: 'scaleX(1)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 180ms ease-out',
        'rise-in': 'rise-in 700ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'scale-in': 'scale-in 520ms cubic-bezier(0.22, 1, 0.36, 1) both',
        'draw-rule': 'draw-rule 700ms cubic-bezier(0.22, 1, 0.36, 1) both',
      },
    },
  },
  plugins: [],
};

export default config;
