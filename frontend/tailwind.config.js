/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--${name}) / <alpha-value>)`

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  // `.dark` on <html> is set before first paint by the inline script in index.html
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // «алюминий» — app background, Sapsan body aluminium
        bg: v('bg'),
        // «белый борт»; `surface-2` is the raised / hovered plate
        surface: { DEFAULT: v('surface'), 2: v('surface-2') },
        // «графит пути»
        ink: v('ink'),
        // text on an ink-filled plate (white in light, deep graphite in dark)
        inverse: v('inverse'),
        muted: v('muted'),
        line: v('line'),
        // «красный РЖД» — primary actions and danger only
        brand: { DEFAULT: v('brand'), dark: v('brand-dark'), soft: v('brand-soft') },
        // semaphore signals — semantic only, never decorative
        ok: { DEFAULT: v('ok'), soft: v('ok-soft') },
        warn: { DEFAULT: v('warn'), ink: v('warn-ink'), soft: v('warn-soft') },
        bad: { DEFAULT: v('brand'), soft: v('brand-soft') },
        // «ночная линия» — the dark hero panels (login, route, tournament, profile, outcome)
        night: { DEFAULT: '#0A101E', 2: '#1F2B47' },
        // category accents — muted, for tiles/chips/competency bars only, never for signals
        cat: {
          conflict: v('cat-conflict'),
          'conflict-soft': v('cat-conflict-soft'),
          medical: v('cat-medical'),
          'medical-soft': v('cat-medical-soft'),
          safety: v('cat-safety'),
          'safety-soft': v('cat-safety-soft'),
          technical: v('cat-technical'),
          'technical-soft': v('cat-technical-soft'),
          service: v('cat-service'),
          'service-soft': v('cat-service-soft'),
          teamwork: v('cat-teamwork'),
          'teamwork-soft': v('cat-teamwork-soft'),
        },
        // achievement rarity rings and plates
        rarity: {
          common: v('rarity-common'),
          rare: v('rarity-rare'),
          epic: v('rarity-epic'),
          legendary: v('rarity-legendary'),
          'rare-soft': v('rarity-rare-soft'),
          'epic-soft': v('rarity-epic-soft'),
          'legendary-soft': v('rarity-legendary-soft'),
          'legendary-ink': v('rarity-legendary-ink'),
        },
      },
      fontFamily: {
        sans: ['"Golos Text"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        display: ['"Fira Sans Extra Condensed"', '"Golos Text"', 'system-ui', 'sans-serif'],
      },
      // 13 / 15 / 17 / 20 / 26 / 34 / 48
      fontSize: {
        xs: ['13px', '18px'],
        sm: ['15px', '22px'],
        base: ['17px', '24px'],
        lg: ['20px', '26px'],
        xl: ['26px', '30px'],
        '2xl': ['34px', '36px'],
        '3xl': ['48px', '48px'],
      },
      borderRadius: { sheet: '20px' },
      boxShadow: {
        dock: 'var(--shadow-dock)',
        card: 'var(--shadow-card)',
        lift: 'var(--shadow-lift)',
        glow: '0 0 0 4px rgb(255 255 255 / 0.06), 0 0 28px 4px var(--glow, rgb(226 26 26 / 0.45))',
        'brand-glow': '0 1px 0 rgb(255 255 255 / 0.18) inset, 0 8px 22px -8px rgb(226 26 26 / 0.65)',
      },
      keyframes: {
        ring: { '0%': { transform: 'scale(.9)', opacity: 0.6 }, '100%': { transform: 'scale(1.9)', opacity: 0 } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
      },
      animation: {
        ring: 'ring 1.8s ease-out infinite',
        shimmer: 'shimmer 1.6s linear infinite',
      },
    },
  },
  plugins: [],
}
