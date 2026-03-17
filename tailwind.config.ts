import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        // GROSS_OUT_POP Palette
        'bruise-purple': '#12001A',
        'fleshy-pink': '#FF007F',
        'toxic-green': '#39FF14',
        'warning-yellow': '#FFD700',
        'dark-void': '#09000D', // Slightly darker than bruise-purple for depth
      },
      fontFamily: {
        // We will load these in layout.tsx next
        display: ['var(--font-bangers)', 'cursive'],
        sans: ['var(--font-inter)', 'sans-serif'],
      },
      boxShadow: {
        // Chunky, flat shadows for that 90s vector art / Pop Art feel
        'chunky': '4px 4px 0px 0px rgba(255, 0, 127, 1)', 
        'chunky-green': '4px 4px 0px 0px rgba(57, 255, 20, 1)',
      },
      screens: {
        // Mobile-first focus. We essentially ignore massive desktop layouts
        // but capping the main container width will happen in our layout components.
        'xs': '375px',
      }
    },
  },
  plugins: [],
};
export default config;