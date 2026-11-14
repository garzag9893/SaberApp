import { defineConfig, devices } from '@playwright/test';

// Pruebas de navegador: flujos completos (flows.spec.js) y regresión visual (visual.spec.js).
// Las capturas de referencia viven en e2e/__screenshots__/. Si un cambio visual es intencional:
//   npm run test:visual:update
const desktop = { viewport: { width: 1280, height: 900 } };

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list']],
  use: {
    baseURL: 'http://localhost:4173',
    locale: 'es-MX',
    timezoneId: 'America/Mexico_City',
    trace: 'off',
  },
  expect: {
    // Límite absoluto (no porcentaje): en páginas largas un cambio de color de acento
    // ocupa menos del 0.05 % y un porcentaje lo dejaría pasar. 150 px cubre el ruido de suavizado.
    toHaveScreenshot: { maxDiffPixels: 150, animations: 'disabled', caret: 'hide' },
  },
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
  webServer: {
    command: 'npm run build && npm run preview -- --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    { name: 'escritorio-oscuro', use: { ...desktop, theme: 'dark' } },
    { name: 'escritorio-claro', use: { ...desktop, theme: 'light' }, testMatch: /visual\.spec/ },
    { name: 'celular', use: { ...devices['Pixel 7'], theme: 'dark' }, testMatch: /visual\.spec/ },
  ],
});
