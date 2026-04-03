import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#101828',
        pearl: '#f8f4ea',
        sand: '#d6c6aa',
        ember: '#c56a1f',
        moss: '#21453d',
        mint: '#dff6df',
        blush: '#ffe5da'
      },
      boxShadow: {
        soft: '0 24px 80px rgba(16, 24, 40, 0.10)'
      },
      fontFamily: {
        sans: ['"Space Grotesk"', 'ui-sans-serif', 'system-ui'],
        mono: ['"IBM Plex Mono"', 'ui-monospace', 'SFMono-Regular']
      },
      backgroundImage: {
        lattice:
          'radial-gradient(circle at top left, rgba(197,106,31,0.17), transparent 30%), radial-gradient(circle at 85% 20%, rgba(33,69,61,0.18), transparent 25%), linear-gradient(135deg, rgba(255,255,255,0.8), rgba(248,244,234,0.9))'
      }
    }
  },
  plugins: []
} satisfies Config;
