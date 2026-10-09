import { fileURLToPath, URL } from 'node:url'
import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import { z } from 'zod'

export default defineConfig(({ mode }) => {
  const { API_PROXY_TARGET } = z
    .object({
      API_PROXY_TARGET: z
        .url({ protocol: /^https?$/ })
        .default('http://localhost:3001'),
    })
    .parse(loadEnv(mode, process.cwd(), 'API_PROXY_'))

  return {
    plugins: [
      tanstackRouter({ target: 'react', autoCodeSplitting: true }),
      react(),
      tailwindcss(),
    ],
    resolve: {
      alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
    },
    server: {
      proxy: {
        '/api': { target: API_PROXY_TARGET, changeOrigin: false },
      },
    },
  }
})
