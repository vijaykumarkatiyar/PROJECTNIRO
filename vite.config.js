import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  base: '/companion/',   // ✅ ADD THIS LINE
  plugins: [
    tailwindcss(),
    react()
  ],
  optimizeDeps: {
    entries: ['index.html']
  }
})