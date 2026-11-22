import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_ACTIONS ? '/Tradebot2/' : '/',
  build: {
    sourcemap: true,
    target: 'es2022',
  },
  server: {
    host: true,
    allowedHosts: true,
  },
});
