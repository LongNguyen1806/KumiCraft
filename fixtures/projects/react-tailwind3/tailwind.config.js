/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#e11d48',
          500: '#f43f5e',
        },
      },
      borderRadius: {
        card: '12px',
      },
    },
  },
  plugins: [],
};
