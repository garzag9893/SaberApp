import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

// Dirección pública de la app (la define el workflow de GitHub Pages). Las redes sociales
// necesitan la dirección completa de la imagen de vista previa; sin ella queda relativa.
const siteUrl = process.env.SITE_URL || './';
const siteUrlPlugin = {
  name: 'site-url',
  transformIndexHtml: (html) => html.replaceAll('%SITE_URL%', siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`),
};

export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss(), siteUrlPlugin],
  // Vitest solo corre las pruebas de lógica; las de navegador las corre Playwright (e2e/).
  test: { include: ['src/**/*.test.js'] },
});
