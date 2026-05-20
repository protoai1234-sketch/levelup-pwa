/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#0F0F0F',
        card: '#1C1C1E',
        input: '#2C2C2E',
        border: '#3A3A3C',
        primary: '#185FA5',
        success: '#1D9E75',
        warning: '#D85A30',
        destructive: '#E24B4A',
        textPrimary: '#FFFFFF',
        textSecondary: '#8E8E93',
        textMuted: '#8E8E93',
      },
      maxWidth: { app: '430px' },
    },
  },
  plugins: [],
};
