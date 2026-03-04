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
          50: '#2a2520',
          100: '#3d3530',
          200: '#e5ddd0',
          300: '#b8923e',
          400: '#a07d2f',
          500: '#8a8078',
          600: '#6b6058',
          700: '#4a4038',
          800: '#e5ddd0',
          850: '#ffffff',
          900: '#f3efe8',
          950: '#faf7f2',
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
