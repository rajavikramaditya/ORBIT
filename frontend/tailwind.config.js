/** @type {import('tailwindcss').Config} */
module.exports = {
    darkMode: ["class"],
    content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Cabinet Grotesk"', '"General Sans"', "sans-serif"],
        sans: ['"Inter"', "sans-serif"],
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)'
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: { DEFAULT: 'hsl(var(--card))', foreground: 'hsl(var(--card-foreground))' },
        popover: { DEFAULT: 'hsl(var(--popover))', foreground: 'hsl(var(--popover-foreground))' },
        primary: { DEFAULT: 'hsl(var(--primary))', foreground: 'hsl(var(--primary-foreground))' },
        secondary: { DEFAULT: 'hsl(var(--secondary))', foreground: 'hsl(var(--secondary-foreground))' },
        muted: { DEFAULT: 'hsl(var(--muted))', foreground: 'hsl(var(--muted-foreground))' },
        accent: { DEFAULT: 'hsl(var(--accent))', foreground: 'hsl(var(--accent-foreground))' },
        destructive: { DEFAULT: 'hsl(var(--destructive))', foreground: 'hsl(var(--destructive-foreground))' },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        // Public marketing surface (Landing + components/landing) only.
        // Literal hex, not var(), so Tailwind's /opacity modifiers work
        // (text-orbit-cream/45 etc.) — a var() colour silently drops them in v3.
        // The matching CSS variables in index.css are for raw-CSS use.
        //
        // The page runs light with dark bands, so there are two text colours and
        // two golds: `gold` is a decorative fill that only works on dark, and
        // `goldink` is the readable-on-white version for label text.
        // Literal hex on purpose: Tailwind v3 silently drops the /opacity
        // modifier when a colour is a var(). text-orbit-cream/55 must work.
        orbit: {
          ink: '#08080B',
          surface: '#101015',
          // Was #F4F1EA. That warm cream sat over the hero video and every
          // light section and read as a haze across the whole site — the
          // "dhundhla" everyone could see but nobody could name. On dark
          // surfaces the readable colour is simply white.
          cream: '#FFFFFF',
          gold: '#E4B871',
          goldink: '#8A6A2F',
          paper: '#FFFFFF',
          // Was #F5F4F0 (beige). Now a neutral grey so light bands separate
          // from white without tinting the page.
          sand: '#F6F6F7',
          text: '#0B0B0F',
          live: '#2FA36B',
        },
      },
      keyframes: {
        'accordion-down': { from: { height: '0' }, to: { height: 'var(--radix-accordion-content-height)' } },
        'accordion-up': { from: { height: 'var(--radix-accordion-content-height)' }, to: { height: '0' } },
        float: { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-10px)' } },
        'float-slow': { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-18px)' } },
        shimmer: { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        'orbit-rise': {
          from: { opacity: '0', transform: 'translateY(14px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        float: 'float 6s ease-in-out infinite',
        'float-slow': 'float-slow 9s ease-in-out infinite',
        'orbit-rise': 'orbit-rise 0.7s cubic-bezier(0.16, 1, 0.3, 1) both',
      }
    }
  },
  plugins: [require("tailwindcss-animate")],
};
