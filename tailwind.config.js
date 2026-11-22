/** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/**/*.{js,ts,jsx,tsx,html}'],
  theme: {
    extend: {
      colors: {
        primary:   '#111827',
        panel:     '#1F2937',
        card:      '#374151',
        accent:    '#6366F1',
        'accent-hover': '#4F46E5',
        'accent-light':  'rgba(99,102,241,0.15)',
        green:     '#10B981',
        red:       '#EF4444',
        yellow:    '#F59E0B',
        orange:    '#F97316',
        blue:      '#3B82F6'
      }
    }
  },
  plugins: []
}