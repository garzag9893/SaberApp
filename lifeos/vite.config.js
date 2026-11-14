import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
  // Vitest solo corre las pruebas de lógica; las de navegador las corre Playwright (e2e/).
  test: { include: ['src/**/*.test.js'] },
});
