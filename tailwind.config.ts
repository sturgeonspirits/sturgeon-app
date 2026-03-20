import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          rust:    '#96321F',
          brown:   '#7E613F',
          cream:   '#F1F1E7',
          tan:     '#C8BCA4',
          olive:   '#87A67F',
          black:   '#242622',
          // surfaces
          bg:      '#F1F1E7',
          bgAlt:   '#E8E4D6',
          surface: '#FFFFFF',
          surfaceTan: '#EDE9DC',
          border:  '#D4CFC3',
          borderDark: '#C8BCA4',
          // text
          muted:   '#9E8F7E',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', 'Franklin Gothic Medium', 'sans-serif'],
        body:    ['var(--font-body)', 'Georgia', 'serif'],
        sans:    ['var(--font-sans)', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
      },
    },
  },
  plugins: [],
}

export default config
