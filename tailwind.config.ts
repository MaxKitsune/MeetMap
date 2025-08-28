import type { Config } from 'tailwindcss'

export default {
  darkMode: 'class',
  content: [
    './app/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './lib/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#6b7280',
          600: '#4b5563',
          700: '#374151',
          800: '#1f2937',
          900: '#111827',
          950: '#0b0f1a',
        },
      },
      boxShadow: {
        glow: '0 0 40px rgba(99,102,241,0.25)',
      },
      backgroundImage: {
        'radial-fade': 'radial-gradient(60% 60% at 50% 0%, rgba(99,102,241,0.25), transparent 70%)',
        'mesh': 'radial-gradient(circle at 20% 10%, rgba(59,130,246,0.3), transparent 30%), radial-gradient(circle at 80% 20%, rgba(236,72,153,0.25), transparent 35%), radial-gradient(circle at 10% 80%, rgba(16,185,129,0.25), transparent 35%), radial-gradient(circle at 90% 70%, rgba(234,179,8,0.25), transparent 35%)',
      },
    },
  },
  plugins: [],
} satisfies Config

