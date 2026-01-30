import type { Config } from 'tailwindcss'

export default {
  content: [
    "./index.html",
    "./**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'source-han': ['"Noto Sans SC"', 'sans-serif'],
      },
    },
  },
  plugins: [],
} satisfies Config
