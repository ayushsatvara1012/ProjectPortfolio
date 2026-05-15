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
        sans: ['"Darker Grotesque"', 'sans-serif'],
        display: ['"Bricolage Grotesque"', 'sans-serif'],
        google: ['"Google Sans"', 'sans-serif'],
      },
      maxWidth: {
        '8xl': '88rem',
      },
    },
  },
  plugins: [],
}