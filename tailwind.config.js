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
    extend: {},
  },
  plugins: [],
}