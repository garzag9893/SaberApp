import { test, expect, openApp, nav } from './fixtures.js';

// Capturas con "reducir movimiento": siempre muestran el estado final de las animaciones
// (y de paso comprueban que la app funciona bien con esa preferencia).
test.use({ reducedMotion: 'reduce' });

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

test.describe('primera vez', () => {
  test.use({ seed: false });

  test('bienvenida: los tres pasos', async ({ page }) => {
    await page.goto('/');
    await page.evaluate(() => document.fonts.ready);
    await expect(page).toHaveScreenshot('bienvenida-1.png');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page).toHaveScreenshot('bienvenida-2.png');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await expect(page).toHaveScreenshot('bienvenida-3.png');
  });

  test('estados vacíos', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('button', { name: 'Continuar' }).click();
    await page.getByRole('radio', { name: /Desde cero/ }).click();
    await page.getByRole('button', { name: 'Entrar a LifeOS' }).click();
    await page.evaluate(() => document.fonts.ready);
    await page.mouse.move(0, 0);
    await expect(page).toHaveScreenshot('vacio-resumen.png', { fullPage: true });
    await nav(page, 'Salud y Hábitos').click();
    await page.mouse.move(0, 0);
    await expect(page).toHaveScreenshot('vacio-salud.png', { fullPage: true });
  });
});
