import { test, expect, openApp, nav } from './fixtures.js';

// Regresión visual: compara cada pantalla con su captura de referencia.
// Corre en tres proyectos: escritorio oscuro, escritorio claro y celular.

const SCREENS = [
  { name: 'resumen', tab: 'Hoy (Resumen)' },
  { name: 'finanzas', tab: 'Finanzas' },
  { name: 'salud', tab: 'Salud y Hábitos' },
  { name: 'agenda', tab: 'Agenda' },
  { name: 'ajustes', tab: 'Ajustes' },
];

for (const screen of SCREENS) {
  test(`pantalla: ${screen.name}`, async ({ page }) => {
    await openApp(page);
    await nav(page, screen.tab).click();
    await page.mouse.move(0, 0); // sin cursor encima de nada
    await expect(page).toHaveScreenshot(`${screen.name}.png`, { fullPage: true });
  });
}

test('agenda: vista semanal', async ({ page }) => {
  await openApp(page);
  await nav(page, 'Agenda').click();
  await page.getByRole('button', { name: 'Semana', exact: true }).click();
  await page.mouse.move(0, 0);
  await expect(page.locator('main')).toHaveScreenshot('agenda-semana.png');
});

test('resumen: detalle al señalar una tarea en el reloj', async ({ page }) => {
  await openApp(page);
  await page.getByRole('button', { name: /^Dentista, 13:15/ }).hover();
  await expect(page.locator('main section').first()).toHaveScreenshot('reloj-detalle.png');
});
