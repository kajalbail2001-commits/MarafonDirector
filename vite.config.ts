import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

import legacy from '@vitejs/plugin-legacy';

// https://vitejs.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    legacy({
      targets: ['defaults', 'not IE 11'],
    }),
  ],
  build: {
    outDir: 'dist',
    // Важно: es2015 обеспечивает работу на старых Android (Telegram WebView)
    target: 'es2015', 
    minify: 'esbuild',
  }
});