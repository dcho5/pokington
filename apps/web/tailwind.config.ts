import type { Config } from 'tailwindcss';
import { tailwindTheme } from '../../packages/ui/src/theme/tailwind';

const config: Config = {
  content: [
    './src/**/*.{js,ts,jsx,tsx}',
    '../../packages/ui/src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: tailwindTheme,
  },
  plugins: [],
};

export default config;
