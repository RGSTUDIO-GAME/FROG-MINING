import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: '.',
  base: './',
  publicDir: 'public',
  envDir: '.',
  envPrefix: 'VITE_',
  resolve: {
    alias: {
      '@': resolve(__dirname, 'src'),
      '@core': resolve(__dirname, 'src/core'),
      '@modules': resolve(__dirname, 'src/modules'),
      '@screens': resolve(__dirname, 'src/screens'),
      '@ui': resolve(__dirname, 'src/ui'),
      '@utils': resolve(__dirname, 'src/utils'),
      '@css': resolve(__dirname, 'src/css'),
      '@shared': resolve(__dirname, 'shared'),
      '@assets': resolve(__dirname, 'public/assets'),
    },
  },
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
    minify: 'esbuild',
    target: 'es2020',
  },
  server: {
    port: 3000,
    open: true,
    proxy: {
      // Forward API calls to the backend during local development.
      '/api': {
        target: 'http://127.0.0.1:3001',
        changeOrigin: true,
      },
    },
  },
});
