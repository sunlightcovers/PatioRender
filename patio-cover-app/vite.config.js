import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
    base: '/', // Heroku serves from the root
  build: {
    outDir: 'dist'
  }
})
