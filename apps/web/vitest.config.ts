/// <reference types="vitest" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: 'src',
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./test-setup.ts'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      '@hooks': path.resolve(__dirname, './src/app/hooks'),
      '@utils': path.resolve(__dirname, './src/app/utils'),
      '@audibook/api-client': path.resolve(__dirname, '../../libs/api-client/src'),
    },
  },
  define: {
    global: 'globalThis',
  },
});
