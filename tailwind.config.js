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
        sans: ['"Darker Grotesque"', 'sans-serif'], // Sets Darker Grotesque as the default body font
        display: ['"Bricolage Grotesque"', 'sans-serif'], // Creates a custom font-display class for headers
        google: ['"Google Sans"', 'sans-serif'], // New Google Sans class
      },
    },
  },
  plugins: [],
}