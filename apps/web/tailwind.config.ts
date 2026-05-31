import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx,mdx}'],
  theme: {
    extend: {
      colors: {
        creme: {
          DEFAULT: 'var(--color-creme)',
          warm: 'var(--color-creme-warm)',
        },
        encre: {
          DEFAULT: 'var(--color-encre)',
          soft: 'var(--color-encre-soft)',
        },
        sauge: {
          DEFAULT: 'var(--color-sauge)',
          soft: 'var(--color-sauge-soft)',
          dark: 'var(--color-sauge-dark)',
        },
        petale: {
          DEFAULT: 'var(--color-petale)',
          soft: 'var(--color-petale-soft)',
          dark: 'var(--color-petale-dark)',
        },
        ciel: {
          DEFAULT: 'var(--color-ciel)',
          soft: 'var(--color-ciel-soft)',
          dark: 'var(--color-ciel-dark)',
        },
        champagne: {
          DEFAULT: 'var(--color-champagne)',
          soft: 'var(--color-champagne-soft)',
          dark: 'var(--color-champagne-dark)',
        },
        // Content Studio v2 — scoped tokens (only used under .cs-v2-shell).
        cs: {
          'bg-base': 'var(--cs-bg-base)',
          'bg-elevated': 'var(--cs-bg-elevated)',
          'bg-sunken': 'var(--cs-bg-sunken)',
          'bg-feature': 'var(--cs-bg-feature)',
          'fg-primary': 'var(--cs-fg-primary)',
          'fg-secondary': 'var(--cs-fg-secondary)',
          'fg-muted': 'var(--cs-fg-muted)',
          'fg-on-accent': 'var(--cs-fg-on-accent)',
          accent: 'var(--cs-accent)',
          'accent-hover': 'var(--cs-accent-hover)',
          'accent-soft': 'var(--cs-accent-soft)',
          'accent-bg': 'var(--cs-accent-bg)',
          clay: 'var(--cs-clay)',
          sage: 'var(--cs-sage)',
          saffron: 'var(--cs-saffron)',
          violet: 'var(--cs-violet)',
          success: 'var(--cs-success)',
          'success-bg': 'var(--cs-success-bg)',
          warning: 'var(--cs-warning)',
          'warning-bg': 'var(--cs-warning-bg)',
          danger: 'var(--cs-danger)',
          'danger-bg': 'var(--cs-danger-bg)',
          'border-hair': 'var(--cs-border-hair)',
          'border-cs': 'var(--cs-border)',
          'border-strong': 'var(--cs-border-strong)',
          'border-focus': 'var(--cs-border-focus)',
        },
      },
      fontFamily: {
        display: ['var(--font-cormorant)', 'Cormorant Garamond', 'Georgia', 'serif'],
        body: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        script: ['var(--font-pinyon)', 'Pinyon Script', 'cursive'],
      },
      fontSize: {
        'display-2xl': ['clamp(64px, 9vw, 128px)', { lineHeight: '1.02', letterSpacing: '-0.025em' }],
        'display-xl': ['clamp(48px, 7vw, 96px)', { lineHeight: '1.03', letterSpacing: '-0.02em' }],
        'display-lg': ['clamp(40px, 5.5vw, 64px)', { lineHeight: '1.05', letterSpacing: '-0.02em' }],
        'display-md': ['clamp(32px, 4vw, 48px)', { lineHeight: '1.08', letterSpacing: '-0.015em' }],
        'display-sm': ['clamp(28px, 3vw, 36px)', { lineHeight: '1.1', letterSpacing: '-0.01em' }],
        'lead': ['clamp(18px, 1.6vw, 22px)', { lineHeight: '1.55' }],
        'kicker': ['11px', { letterSpacing: '0.18em', lineHeight: '1.4' }],
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
      },
      maxWidth: {
        prose: 'var(--max-width-prose)',
        content: 'var(--max-width-content)',
        wide: 'var(--max-width-wide)',
        page: 'var(--max-width-page)',
      },
      borderRadius: {
        none: '0',
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
        xl: 'var(--shadow-xl)',
      },
      transitionDuration: {
        instant: '100ms',
        fast: '200ms',
        base: '300ms',
        slow: '500ms',
        cinematic: '800ms',
      },
      transitionTimingFunction: {
        'out-soft': 'cubic-bezier(0.22, 1, 0.36, 1)',
        'in-out-silk': 'cubic-bezier(0.65, 0, 0.35, 1)',
        'in-quiet': 'cubic-bezier(0.4, 0, 1, 1)',
      },
      keyframes: {
        // §4.6 — micro-pulse discret du CTA pack (3,5 s, amplitude 2 %).
        // Volontairement faible : on cherche un signal d'attention, pas
        // une animation criarde. `motion-safe:` désactive auto si l'OS
        // demande `prefers-reduced-motion`.
        'soft-pulse': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.02)' },
        },
        // §5 W4 — fade-in du WizardCheckmark (200 ms, ease-out).
        // Apparait quand un champ devient valide. Utilisé par
        // `motion-safe:animate-fade-in`.
        'fade-in': {
          '0%': { opacity: '0', transform: 'translateY(2px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'soft-pulse': 'soft-pulse 3.5s ease-in-out infinite',
        'fade-in': 'fade-in 0.2s ease-out',
      },
    },
  },
  plugins: [],
};

export default config;
