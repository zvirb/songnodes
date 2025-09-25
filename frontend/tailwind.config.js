/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // DJ-themed dark color palette
        'dj-black': '#0a0a0a',
        'dj-dark': '#1a1a1a',
        'dj-gray': '#2a2a2a',
        'dj-light-gray': '#3a3a3a',
        'dj-accent': '#00ff41', // Matrix green for highlights
        'dj-danger': '#ff0040',
        'dj-warning': '#ffaa00',
        'dj-info': '#00aaff',
      },
      animation: {
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(0, 255, 65, 0.5)' },
          '100%': { boxShadow: '0 0 20px rgba(0, 255, 65, 0.8)' },
        }
      }
    },
  },
  plugins: [],
}