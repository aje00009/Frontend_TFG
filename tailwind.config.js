/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
    "./src/style.css",
  ],
  theme: {
    extend: {
      colors: {
        terra: {
          bg: 'rgb(var(--terra-bg-rgb))',
          surface: 'rgb(var(--terra-surface-rgb))',
          'surface-light': 'rgb(var(--terra-surface-light-rgb))',
          text: 'rgb(var(--terra-text-rgb))',
          muted: 'rgb(var(--terra-muted-rgb))',
          subtle: 'rgb(var(--terra-subtle-rgb))',
          dim: 'rgb(var(--terra-dim-rgb))',
          accent: 'rgb(var(--terra-accent-rgb))',
          'accent-hover': 'rgb(var(--terra-accent-hover-rgb))',
          'accent-warm': 'rgb(var(--terra-accent-warm-rgb))',
          border: 'rgba(var(--terra-accent-rgb), 0.12)',
          panel: 'rgb(var(--terra-surface-rgb))',
          overlay: 'rgb(var(--terra-surface-rgb))',
          divider: 'rgb(var(--terra-text-rgb))',
        },
        // Compatibilidad con componentes antiguos (GEU)
        geu: {
          bg: 'rgb(var(--terra-bg-rgb))',
          panel: 'rgb(var(--terra-surface-rgb))',
          accent: 'rgb(var(--terra-accent-rgb))',
          accent2: 'rgb(var(--terra-accent-warm-rgb))',
        }
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'Helvetica Neue', 'Arial', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
