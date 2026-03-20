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
          rust:   '#96321F',   // primary accent
          brown:  '#7E613F',   // secondary
          cream:  '#F1F1E7',   // light text / backgrounds
          tan:    '#C8BCA4',   // muted text, borders
          olive:  '#87A67F',   // accent green
          black:  '#242622',   // brand black
          bg:     '#0e0d0b',   // near-black warm
          surface:'#161410',   // warm dark surface
          border: '#2c2820',   // warm dark border
        },
      },
      fontFamily: {
        // Next.js font loader injects CSS variables on <html>; reference them here
        sans:    ['var(--font-sans)', '-apple-system', 'BlinkMacSystemFont', 'sans-serif'],
        display: ['var(--font-display)', 'Georgia', 'serif'],
      },
    },
  },
  plugins: [],
}

export default config
