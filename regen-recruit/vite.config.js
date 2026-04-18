import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      // Forward /predict → http://localhost:8000/predict (avoids CORS in dev)
      '/predict': {
        target: 'http://localhost:8000',
        changeOrigin: true,
      },
    },
  },
})
