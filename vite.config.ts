import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    outDir: 'dist',
    // Важно: es2015 обеспечивает работу на старых Android (Telegram WebView)
    target: 'es2015', 
    minify: 'esbuild',
  }
});