/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        raven: {
          50: '#1a1a2e',       // darkest — headings, primary text
          100: '#2d2d44',
          200: '#e2e8f0',      // borders
          300: '#03ABFA',      // PRIMARY ACCENT — cyan (buttons, links, active)
          400: '#0299e0',      // cyan hover
          500: '#64748b',      // muted text
          600: '#475569',
          700: '#334155',
          800: '#f1f5f9',      // light surface (cards on gray bg)
          850: '#ffffff',      // card backgrounds
          900: '#f8f9fc',      // light page sections
          950: '#ffffff',      // page background
        }
      },
      fontFamily: {
        display: ['"Playfair Display"', 'Georgia', 'serif'],
        body: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
      }
    },
  },
  plugins: [],
}
