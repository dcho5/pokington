import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      screens: {
        xs: '375px',  // iPhone SE 2nd/3rd gen — min-width breakpoint
      },
      colors: {
        felt: {
          DEFAULT: '#1a5c2a',
          dark: '#0f3d1a',
          light: '#2a7d3f',
        },
        wood: {
          DEFAULT: '#5c3a1e',
          dark: '#3d2513',
          light: '#7d5a3a',
        },
        gold: {
          DEFAULT: '#d4a847',
          light: '#e8c76a',
        },
        chip: {
          white: '#f0f0f0',
          red: '#d32f2f',
          blue: '#1976d2',
          green: '#388e3c',
          black: '#212121',
        },
        mobile: {
          surface: '#030712',
          card: '#0f1117',
        },
      },
    },
  },
  plugins: [],
};

export default config;
