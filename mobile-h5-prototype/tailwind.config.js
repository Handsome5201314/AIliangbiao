/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'Noto Sans SC', 'system-ui', 'sans-serif'],
      },
      colors: {
        sage: {
          50: '#F0F7F4',
          100: '#DCEEDF',
          200: '#B8DCC6',
          300: '#8CC6A7',
          400: '#5DB08C',
          500: '#4A9B78',
          600: '#3A7D60',
          700: '#2F644D',
          800: '#264F3E',
          900: '#1E3F32',
        },
        sky: {
          50: '#F0F7FC',
          100: '#DCEEF8',
          200: '#B8DDF1',
          300: '#7BBCE0',
          400: '#4A9FCC',
          500: '#3085B3',
          600: '#266B90',
          700: '#1E5472',
          800: '#18425A',
          900: '#123244',
        },
        warm: {
          50: '#FFF8F0',
          100: '#FFEDD6',
          200: '#FFD9AD',
          300: '#FFC078',
          400: '#F2994A',
          500: '#E8862F',
          600: '#CC6B1A',
          700: '#A85416',
          800: '#864212',
          900: '#6B350F',
        },
        cream: {
          50: '#FAFCFB',
          100: '#F5FAF8',
          200: '#EFF5F2',
          300: '#E8F0ED',
          400: '#D4E2DC',
          500: '#B8CFC5',
        },
        foreground: '#2D3748',
        muted: '#94A3B8',
        destructive: '#E57373',
        success: '#66BB6A',
        warning: '#FFB74D',
      },
      borderRadius: {
        card: '20px',
        button: '12px',
        pill: '999px',
      },
      fontSize: {
        xs: ['12px', { lineHeight: '1.4' }],
        sm: ['13px', { lineHeight: '1.5' }],
        base: ['15px', { lineHeight: '1.6' }],
        lg: ['17px', { lineHeight: '1.5' }],
        xl: ['20px', { lineHeight: '1.4' }],
        '2xl': ['24px', { lineHeight: '1.3' }],
      },
      spacing: {
        'safe-bottom': 'env(safe-area-inset-bottom, 0px)',
        'safe-top': 'env(safe-area-inset-top, 0px)',
      },
      minHeight: {
        touch: '44px',
        button: '48px',
        option: '52px',
      },
      animation: {
        'slide-in-right': 'slideInRight 0.3s ease-out',
        'slide-in-up': 'slideInUp 0.3s ease-out',
        'fade-in': 'fadeIn 0.2s ease-out',
        'progress': 'progressGrow 0.4s ease-out',
      },
      keyframes: {
        slideInRight: {
          '0%': { transform: 'translateX(100%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        slideInUp: {
          '0%': { transform: 'translateY(100%)' },
          '100%': { transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        progressGrow: {
          '0%': { width: '0%' },
        },
      },
    },
  },
  plugins: [],
}
