/** @type {import('tailwindcss').Config} */
// Colors are driven by CSS variables (RGB channel triplets) defined in
// src/styles/index.css under :root (light) and .dark (dark) so the whole
// palette — including /opacity modifiers — flips with the theme.
const v = (name) => `rgb(var(${name}) / <alpha-value>)`;
export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // --- Canvas & surfaces (neutrals do ~85% of the work) ---
        bg: v('--c-bg'), // warm bone page background
        surface: v('--c-surface'), // cards, sheets
        'surface-sunk': v('--c-surface-sunk'), // wells, skeletons
        border: v('--c-border'), // hairline dividers

        // --- Text ---
        ink: {
          DEFAULT: v('--c-ink'), // primary, warm near-black
          soft: v('--c-ink-soft'), // secondary
          faint: v('--c-ink-faint'), // tertiary / meta
        },

        // --- Accents (used sparingly) ---
        clay: {
          DEFAULT: v('--c-clay'), // PRIMARY accent
          press: v('--c-clay-press'), // pressed/hover
          soft: v('--c-clay-soft'), // tint background
        },
        olive: {
          DEFAULT: v('--c-olive'), // secondary
          soft: v('--c-olive-soft'),
        },
        saffron: {
          DEFAULT: v('--c-saffron'), // highlights, ratings
          soft: v('--c-saffron-soft'),
        },
        majorelle: {
          DEFAULT: v('--c-majorelle'), // rare jewel accent / links
          soft: v('--c-majorelle-soft'),
        },
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        body: ['Inter', 'system-ui', 'sans-serif'],
      },
      fontSize: {
        // Editorial scale — ~6 sizes, don't invent more
        meta: ['0.8125rem', { lineHeight: '1.4' }], // 13px
        base: ['1rem', { lineHeight: '1.5' }], // 16px
        h3: ['1.0625rem', { lineHeight: '1.4', fontWeight: '600' }], // 17
        h2: ['1.25rem', { lineHeight: '1.25' }], // 20
        h1: ['1.625rem', { lineHeight: '1.15' }], // 26
        display: ['2.25rem', { lineHeight: '1.08', letterSpacing: '-0.01em' }], // 36
      },
      borderRadius: {
        // Varied, moderate radii — not one big radius everywhere
        input: '10px',
        card: '12px',
        image: '12px',
        sheet: '20px',
      },
      boxShadow: {
        // One subtle elevation token; prefer hairline borders + whitespace
        e1: '0 1px 2px rgba(43,38,32,.06), 0 8px 24px rgba(43,38,32,.05)',
      },
      maxWidth: {
        app: '480px',
        shell: '1120px',
      },
      backgroundImage: {
        scrim: 'linear-gradient(to top, rgba(43,38,32,.55), transparent 55%)',
        'scrim-strong': 'linear-gradient(to top, rgba(43,38,32,.72), rgba(43,38,32,.15) 60%, transparent)',
      },
      keyframes: {
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'fade': {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        'sheet-up': {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-400px 0' },
          '100%': { backgroundPosition: '400px 0' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.3s ease-out both',
        fade: 'fade 0.25s ease-out both',
        'sheet-up': 'sheet-up 0.25s cubic-bezier(0.16, 1, 0.3, 1) both',
        shimmer: 'shimmer 1.4s linear infinite',
      },
      transitionTimingFunction: {
        'out-soft': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
};
