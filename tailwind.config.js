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
          50: '#fdf8f0',
          100: '#f5e6cc',
          200: '#e8c88a',
          300: '#c9a55c',
          400: '#b8923e',
          500: '#a07d2f',
          600: '#7a5f24',
          700: '#54411a',
          800: '#1a1a24',
          850: '#13131b',
          900: '#0d0d14',
          950: '#08080d',
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
