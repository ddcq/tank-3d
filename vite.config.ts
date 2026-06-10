import { defineConfig } from 'vite'
import basicSsl from '@vitejs/plugin-basic-ssl'

export default defineConfig({
  base: './',
  plugins: [basicSsl()],
  server: {
    https: true,
  },
  build: {
    target: 'ES2022',
  },
})
