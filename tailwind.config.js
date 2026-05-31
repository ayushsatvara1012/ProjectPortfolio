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
      },
      maxWidth: {
        '8xl': '88rem',
      },
    },
  },
  plugins: [],
}