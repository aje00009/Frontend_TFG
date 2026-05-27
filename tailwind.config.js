/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        geu: {
          bg: '#232323',
          panel: '#2b2b2b',
          accent: '#3b82f6',
          accent2: '#f97316',
        }
      }
    },
  },
  plugins: [],
};
