/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html','./src/**/*.{js,jsx,ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        surface: {
          0: '#0a0e14',
          1: '#0f1520',
          2: '#151d2e',
          3: '#1a2438',
          4: '#1f2c42',
          5: '#243350',
        },
        accent: {
          blue:   '#3b82f6',
          cyan:   '#06b6d4',
          green:  '#10b981',
          amber:  '#f59e0b',
          red:    '#ef4444',
          purple: '#8b5cf6',
        },
        border: {
          subtle:  'rgba(255,255,255,0.06)',
          normal:  'rgba(255,255,255,0.10)',
          strong:  'rgba(255,255,255,0.18)',
        }
      },
      fontFamily: {
        sans:  ['Inter','system-ui','sans-serif'],
        mono:  ['JetBrains Mono','Fira Code','monospace'],
      },
      fontSize: {
        '2xs': ['0.65rem', { lineHeight: '1rem' }],
      }
    }
  },
  plugins: [require('@tailwindcss/typography')]
}
