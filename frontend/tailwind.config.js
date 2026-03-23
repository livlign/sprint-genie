/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['DM Sans', 'system-ui', 'sans-serif'],
        display: ['Fraunces', 'Georgia', 'serif'],
      },
      colors: {
        surface: {
          DEFAULT: '#171615',
          2: '#211f1d',
          3: '#2b2926',
        },
        border: {
          DEFAULT: '#302d2a',
          hover: '#4a4540',
        },
        accent: {
          coral: '#e8845e',
          teal: '#59c99b',
          purple: '#b0a4f0',
          blue: '#6aadeb',
          warn: '#e8c45e',
        },
      },
      borderRadius: {
        '2xl': '16px',
        '3xl': '20px',
      },
    },
  },
  plugins: [],
}
