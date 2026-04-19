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
      // Forward /predict → https://codejvn-classfy-dkd-backend.hf.space/predict (avoids CORS in dev)
      '/predict': {
        target: 'https://codejvn-classfy-dkd-backend.hf.space',
        changeOrigin: true,
        secure: true,
      },
    },
  },
})
