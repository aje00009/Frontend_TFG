/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./src/style.css",
  ],
  theme: {
    extend: {
      colors: {
        terra: {
          bg: '#080c0a',
          surface: '#111815',
          'surface-light': '#1a211e',
          accent: '#2dd4a0',
          'accent-hover': '#22c28e',
          'accent-warm': '#fbbf24',
          border: 'rgba(45, 212, 160, 0.12)',
        },
        // Compatibilidad con componentes antiguos (GEU)
        geu: {
          bg: '#080c0a',
          panel: '#111815',
          accent: '#2dd4a0',
          accent2: '#fbbf24',
        }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
