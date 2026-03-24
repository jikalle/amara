/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Anara brand palette
        earth:     '#1A1208',
        soil:      '#221A0E',
        clay:      '#2E2010',
        clay2:     '#3A2A14',
        border:    '#4A3520',
        border2:   '#6A5030',
        gold:      '#D4920A',
        gold2:     '#F0B429',
        kola:      '#C0392B',
        kola2:     '#E74C3C',
        turmeric:  '#E8A020',
        cream:     '#F5E6C8',
        cream2:    '#C8AA7A',
        muted:     '#7A5E3A',
        muted2:    '#5A4228',
        // Chain colors
        'chain-base':  '#1C6EFF',
        'chain-eth':   '#627EEA',
        'chain-arb':   '#28A0F0',
        'chain-op':    '#FF0420',
        'chain-bnb':   '#F3BA2F',
        'chain-poly':  '#8247E5',
        'chain-avax':  '#E84142',
        'chain-sol':   '#9945FF',
        'chain-zk':    '#7B61FF',
        'chain-linea': '#61DAFB',
      },
      fontFamily: {
        display: ['Playfair Display', 'serif'],
        body:    ['DM Sans', 'sans-serif'],
        mono:    ['Space Mono', 'monospace'],
      },
      backgroundImage: {
        'kente': "repeating-linear-gradient(90deg, #D4920A 0,#D4920A 10px, #C0392B 10px, #C0392B 20px, #E8A020 20px, #E8A020 30px, #1A1208 30px, #1A1208 36px)",
        'mudcloth': "repeating-linear-gradient(0deg, transparent, transparent 28px, rgba(212,146,10,0.15) 28px, rgba(212,146,10,0.15) 29px), repeating-linear-gradient(90deg, transparent, transparent 28px, rgba(212,146,10,0.15) 28px, rgba(212,146,10,0.15) 29px)",
      },
      animation: {
        'pulse-dot': 'pulse-dot 1.8s ease-in-out infinite',
        'ticker':    'ticker 28s linear infinite',
        'slide-up':  'slide-up 0.35s cubic-bezier(.32,.72,0,1)',
        'slide-in':  'slide-in 0.35s cubic-bezier(.32,.72,0,1)',
        'fade-in':   'fade-in 0.4s ease',
      },
      keyframes: {
        'pulse-dot': {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(46,204,113,0.5)' },
          '50%':      { boxShadow: '0 0 0 7px rgba(46,204,113,0)' },
        },
        'ticker': {
          from: { transform: 'translateX(50%)' },
          to:   { transform: 'translateX(-100%)' },
        },
        'slide-up': {
          from: { transform: 'translateY(100%)', opacity: '0' },
          to:   { transform: 'translateY(0)',    opacity: '1' },
        },
        'slide-in': {
          from: { transform: 'translateX(100%)' },
          to:   { transform: 'translateX(0)' },
        },
        'fade-in': {
          from: { opacity: '0' },
          to:   { opacity: '1' },
        },
      },
    },
  },
  plugins: [],
}
