import type { Config } from 'tailwindcss';

/**
 * VELORA PRIVATE — design tokens
 * Direction: obsidian black, ivory, off-white, graphite, whispered gold.
 * Deliberately restrained: hairlines over shadows, tracking over weight,
 * motion measured in tens of milliseconds, not hundreds.
 */
const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    container: {
      center: true,
      padding: { DEFAULT: '1.5rem', xl: '2.5rem' },
      screens: { sm: '640px', md: '768px', lg: '1024px', xl: '1240px', '2xl': '1240px' },
    },
    extend: {
      fontFamily: {
        serif: ['var(--font-display)', 'Georgia', 'Times New Roman', 'serif'],
        sans: ['var(--font-sans)', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      colors: {
        ink: {
          1000: '#07080A',
          950: '#090A0D',
          900: '#0D0F13',
          850: '#11141A',
          800: '#161A21',
          750: '#1C212A',
          700: '#252A34',
          600: '#313846',
          500: '#434C5C',
        },
        ivory: {
          50: '#FDFBF7',
          100: '#F7F3EA',
          200: '#EEE8DB',
          300: '#E1D9C7',
          400: '#CFC5AE',
        },
        graphite: {
          100: '#C2C7CE',
          200: '#A6ACB5',
          300: '#8A909A',
          400: '#6E747E',
          500: '#575D66',
          600: '#434850',
          700: '#33373D',
        },
        gold: {
          50: '#F7EFDD',
          100: '#EFE1C4',
          200: '#E2CDA1',
          300: '#D5B985',
          400: '#C9A96A',
          500: '#B79556',
          600: '#95753C',
          700: '#6C552B',
          800: '#453619',
        },
        state: {
          ok: '#8CA98D',
          info: '#8C99AC',
          warn: '#C8A96C',
          risk: '#BC7E74',
        },
      },
      letterSpacing: {
        micro: '0.16em',
        label: '0.28em',
        lux: '0.42em',
      },
      fontSize: {
        'display-xl': ['clamp(2.9rem, 7.4vw, 6.6rem)', { lineHeight: '1.03', letterSpacing: '0.015em' }],
        'display-lg': ['clamp(2.25rem, 4.6vw, 4rem)', { lineHeight: '1.08', letterSpacing: '0.02em' }],
        'display-md': ['clamp(1.6rem, 2.8vw, 2.5rem)', { lineHeight: '1.16', letterSpacing: '0.03em' }],
        'display-sm': ['clamp(1.2rem, 1.8vw, 1.6rem)', { lineHeight: '1.3', letterSpacing: '0.04em' }],
        label: ['0.6875rem', { lineHeight: '1rem', letterSpacing: '0.28em' }],
      },
      transitionTimingFunction: {
        lux: 'cubic-bezier(0.16, 1, 0.3, 1)',
        'lux-in': 'cubic-bezier(0.7, 0, 0.84, 0)',
      },
      transitionDuration: {
        400: '400ms',
        600: '600ms',
        900: '900ms',
      },
      boxShadow: {
        lift: '0 30px 70px -40px rgba(0,0,0,0.9)',
        card: '0 1px 0 0 rgba(247,243,234,0.04) inset, 0 24px 60px -40px rgba(0,0,0,0.8)',
        glow: '0 0 0 1px rgba(201,169,106,0.28), 0 24px 60px -30px rgba(201,169,106,0.14)',
      },
      backgroundImage: {
        'hairline-top': 'linear-gradient(to bottom, rgba(247,243,234,0.07), rgba(247,243,234,0) 60%)',
        'gold-sheen':
          'linear-gradient(100deg, rgba(201,169,106,0) 0%, rgba(226,205,161,0.55) 45%, rgba(201,169,106,0) 90%)',
        vignette: 'radial-gradient(120% 90% at 50% 0%, rgba(201,169,106,0.07) 0%, rgba(7,8,10,0) 55%)',
      },
      keyframes: {
        'fade-up': {
          from: { opacity: '0', transform: 'translate3d(0, 18px, 0)' },
          to: { opacity: '1', transform: 'translate3d(0, 0, 0)' },
        },
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'fade-right': {
          from: { opacity: '0', transform: 'translate3d(-14px, 0, 0)' },
          to: { opacity: '1', transform: 'translate3d(0, 0, 0)' },
        },
        sheen: {
          '0%': { transform: 'translateX(-120%)' },
          '100%': { transform: 'translateX(220%)' },
        },
        'pulse-soft': {
          '0%,100%': { opacity: '0.85', transform: 'scale(1)' },
          '50%': { opacity: '0.35', transform: 'scale(1.35)' },
        },
        'draw-line': {
          from: { strokeDashoffset: '1' },
          to: { strokeDashoffset: '0' },
        },
        'shimmer-skeleton': {
          '0%': { opacity: '0.35' },
          '50%': { opacity: '0.7' },
          '100%': { opacity: '0.35' },
        },
        'caret-blink': {
          '0%,49%': { opacity: '1' },
          '50%,100%': { opacity: '0' },
        },
        'scroll-cue': {
          '0%': { transform: 'translateY(-6px)', opacity: '0' },
          '35%': { opacity: '1' },
          '100%': { transform: 'translateY(14px)', opacity: '0' },
        },
      },
      animation: {
        'fade-up': 'fade-up 700ms cubic-bezier(0.16,1,0.3,1) both',
        'fade-in': 'fade-in 600ms ease-out both',
        'fade-right': 'fade-right 600ms cubic-bezier(0.16,1,0.3,1) both',
        sheen: 'sheen 2.6s ease-in-out infinite',
        'pulse-soft': 'pulse-soft 2.6s ease-in-out infinite',
        'shimmer-skeleton': 'shimmer-skeleton 1.6s ease-in-out infinite',
        'caret-blink': 'caret-blink 1.1s step-end infinite',
        'scroll-cue': 'scroll-cue 2.2s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};

export default config;
