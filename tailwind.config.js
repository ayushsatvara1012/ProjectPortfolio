/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  // ADD THIS BLOCK:
  corePlugins: {
    preflight: false, // Prevents Tailwind from overwriting client website defaults
  },
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-google)', 'system-ui', 'sans-serif'],
        display: ['var(--font-google)', 'system-ui', 'sans-serif'],
        google: ['var(--font-google)', 'system-ui', 'sans-serif'],
        open: ['var(--font-open)', 'sans-serif'],
      },
      maxWidth: {
        '8xl': '88rem',
      },
      // Vaayu product accent (keep in sync with VAAYU_ACCENT in src/lib/brand.ts).
      // Taken from vaayu_logo.svg gradient (#004DE8 → #002B82).
      colors: {
        vaayu: {
          light: '#3B82F6',
          DEFAULT: '#004DE8',
          dark: '#002B82',
        },
      },
    },
  },
  plugins: [],
}