/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  darkMode: 'class', // Enable class-based dark mode
  theme: {
    extend: {
      colors: {
        // Define custom colors for light/dark mode if needed
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}