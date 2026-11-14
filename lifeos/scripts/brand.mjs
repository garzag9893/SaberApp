// Genera el kit de marca de LifeOS a partir de la app real:
//   public/og-image.png            imagen para compartir enlaces (1200×630)
//   brand/capturas/*.png           capturas en marco de teléfono (1080×1920)
//   brand/hoja-de-marca.png        logo, colores y tipografía
// Uso: npm run brand   (compila la app, la abre con datos de ejemplo y toma las imágenes)

import { chromium } from '@playwright/test';
import { spawn, execSync } from 'node:child_process';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { demoData, NOW } from '../e2e/fixtures.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const PORT = 4175;
const URL = `http://localhost:${PORT}/`;

// --- Tokens (los mismos de src/index.css y DESIGN.md) ---
const T = {
  night: '#14121c', card: '#1e1b29', line: '#2e2a3d', ink: '#edebf4', muted: '#9c96b3',
  jacaranda: '#9886f0', jacarandaDeep: '#6a53d6', marigold: '#f5a63a', nopal: '#3fc48f', granada: '#f9637b', agua: '#4fb3e3',
};

const font = (pkg, file) => `data:font/woff2;base64,${readFileSync(join(root, 'node_modules', pkg, 'files', file)).toString('base64')}`;
const FONTS = `
  @font-face { font-family: 'Bricolage'; src: url('${font('@fontsource-variable/bricolage-grotesque', 'bricolage-grotesque-latin-wght-normal.woff2')}'); font-weight: 200 800; }
  @font-face { font-family: 'Figtree'; src: url('${font('@fontsource-variable/figtree', 'figtree-latin-wght-normal.woff2')}'); font-weight: 300 900; }
  @font-face { font-family: 'Plex Mono'; src: url('${font('@fontsource/ibm-plex-mono', 'ibm-plex-mono-latin-400-normal.woff2')}'); font-weight: 400; }
  @font-face { font-family: 'Plex Mono'; src: url('${font('@fontsource/ibm-plex-mono', 'ibm-plex-mono-latin-600-normal.woff2')}'); font-weight: 600; }
  * { margin: 0; box-sizing: border-box; }
  body { font-family: 'Figtree', sans-serif; color: ${T.ink}; -webkit-font-smoothing: antialiased; }
  .display { font-family: 'Bricolage', sans-serif; letter-spacing: -0.02em; }
  .mono { font-family: 'Plex Mono', monospace; }
`;
const icon = `data:image/svg+xml;base64,${readFileSync(join(root, 'public/icon.svg')).toString('base64')}`;
const png = (buf) => `data:image/png;base64,${buf.toString('base64')}`;

async function render(browser, html, width, height, out) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.setContent(`<!doctype html><html><head><meta charset="utf-8"><style>${FONTS}</style></head><body>${html}</body></html>`);
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: out });
  await page.close();
  console.log('  ✓', out.replace(`${root}/`, ''));
}

// Abre la app con datos de ejemplo y fecha fija.
async function appPage(browser, { seed = true, viewport, scale = 3 }) {
  const ctx = await browser.newContext({
    viewport, deviceScaleFactor: scale, isMobile: viewport.width < 600, hasTouch: viewport.width < 600,
    reducedMotion: 'reduce', locale: 'es-MX', timezoneId: 'America/Mexico_City',
  });
  const page = await ctx.newPage();
  await page.clock.setFixedTime(NOW);
  await page.addInitScript(({ data, s }) => {
    localStorage.clear();
    localStorage.setItem('lifeos_prefs_v6', JSON.stringify({ theme: 'dark', name: 'Ana', onboarded: s, reminders: { enabled: false, minutesBefore: 10 }, simOffset: 0 }));
    if (s) localStorage.setItem('lifeos_data_v6', JSON.stringify(data));
  }, { data: demoData(), s: seed });
  await page.goto(URL);
  await page.evaluate(() => document.fonts.ready);
  return { page, ctx };
}

async function main() {
  console.log('Compilando…');
  execSync('npm run build', { cwd: root, stdio: 'ignore' });
  const server = spawn('npx', ['vite', 'preview', '--port', String(PORT), '--strictPort'], { cwd: root, stdio: 'ignore' });
  for (let i = 0; i < 50; i += 1) {
    try { if ((await fetch(URL)).ok) break; } catch { /* aún no está listo */ }
    await new Promise((r) => setTimeout(r, 200));
  }

  const browser = await chromium.launch();
  try {
    mkdirSync(join(root, 'brand/capturas'), { recursive: true });

    // 1. El reloj de la bienvenida, completo, para la imagen de enlaces.
    const welcome = await appPage(browser, { seed: false, viewport: { width: 1280, height: 900 }, scale: 2 });
    await welcome.page.getByRole('button', { name: 'Continuar' }).click();
    await welcome.page.getByRole('button', { name: 'Continuar' }).click();
    await welcome.page.addStyleTag({ content: 'html, body, #root, #root * { background: transparent !important; }' });
    const dial = await welcome.page.locator('svg[aria-label^="El día como un reloj"]').screenshot({ omitBackground: true });
    await welcome.ctx.close();

    // 2. Pantallas de la app en tamaño de teléfono.
    const phone = { width: 390, height: 844 };
    const shots = {};
    const app = await appPage(browser, { viewport: phone });
    const nav = (name) => app.page.locator('nav[data-nav]:visible').getByRole('button', { name });
    const main = app.page.locator('main');
    // Desplaza la página para que el elemento quede a `offset` px del borde superior.
    const scrollTo = async (locator, offset) => {
      await locator.evaluate((el, off) => window.scrollTo(0, el.getBoundingClientRect().top + window.scrollY - off), offset);
      await app.page.waitForTimeout(150);
    };
    await app.page.mouse.move(0, 0);
    shots.resumen = await app.page.screenshot();
    await nav('Agenda').click();
    await app.page.getByRole('button', { name: 'Semana', exact: true }).click();
    await scrollTo(main.locator('.lg\\:grid-cols-7'), 90);
    shots.agenda = await app.page.screenshot();
    await nav('Finanzas').click();
    await scrollTo(app.page.getByRole('heading', { name: 'Tendencia' }), 24);
    shots.finanzas = await app.page.screenshot();
    await nav('Salud y Hábitos').click();
    await scrollTo(app.page.getByRole('heading', { name: 'Hábitos Diarios' }), 24);
    shots.salud = await app.page.screenshot();
    await app.ctx.close();

    // --- Imagen para compartir enlaces ---
    await render(browser, `
      <div style="width:1200px;height:630px;background:radial-gradient(circle at 78% 50%, #2a2350 0%, ${T.night} 58%);display:flex;align-items:center;padding:0 72px;gap:40px;overflow:hidden">
        <div style="flex:1">
          <div style="display:flex;align-items:center;gap:14px"><img src="${icon}" width="52" height="52"><span class="display" style="font-size:30px;font-weight:700">LifeOS</span></div>
          <p class="mono" style="color:${T.marigold};letter-spacing:.24em;font-size:15px;margin-top:56px">AGENDA · DINERO · HÁBITOS</p>
          <h1 class="display" style="font-size:76px;line-height:1;font-weight:800;margin-top:14px">Tu día,<br>en un solo vistazo.</h1>
          <p style="font-size:24px;color:${T.muted};margin-top:24px;line-height:1.4">Todo alrededor de un reloj de 24 horas.<br>Funciona sin conexión.</p>
        </div>
        <img src="${png(dial)}" style="width:470px;height:auto;margin-right:-30px">
      </div>`, 1200, 630, join(root, 'public/og-image.png'));

    // --- Capturas en marco de teléfono ---
    const SLIDES = [
      { key: 'resumen', eyebrow: 'RESUMEN', title: 'Tu día como un reloj.', text: 'Cada tarea es un arco; la manecilla marca el ahora.' },
      { key: 'agenda', eyebrow: 'AGENDA', title: 'La semana completa.', text: 'Tareas que se repiten y aviso cuando dos chocan.' },
      { key: 'finanzas', eyebrow: 'DINERO', title: 'Mes a mes.', text: 'Ingresos, gastos y presupuestos que avisan a tiempo.' },
      { key: 'salud', eyebrow: 'HÁBITOS', title: 'Constancia visible.', text: 'Cada día que cumples se ve más intenso.' },
    ];
    for (const [i, s] of SLIDES.entries()) {
      await render(browser, `
        <div style="width:1080px;height:1920px;background:radial-gradient(circle at 50% 78%, #2a2350 0%, ${T.night} 62%);display:flex;flex-direction:column;align-items:center;padding-top:150px;overflow:hidden">
          <p class="mono" style="color:${T.marigold};letter-spacing:.28em;font-size:30px">${s.eyebrow}</p>
          <h1 class="display" style="font-size:104px;font-weight:800;line-height:1;margin-top:24px;text-align:center">${s.title}</h1>
          <p style="font-size:40px;color:${T.muted};margin-top:28px;text-align:center;max-width:820px;line-height:1.35">${s.text}</p>
          <div style="margin-top:96px;width:780px;border-radius:96px;padding:22px;background:${T.line};box-shadow:0 60px 120px rgba(0,0,0,.55), inset 0 0 0 2px #46415a">
            <img src="${png(shots[s.key])}" style="display:block;width:100%;border-radius:76px">
          </div>
        </div>`, 1080, 1920, join(root, `brand/capturas/${i + 1}-${s.key}.png`));
    }

    // --- Hoja de marca ---
    const swatch = (name, hex, use, dark = false) => `
      <div style="display:flex;flex-direction:column;gap:10px">
        <div style="height:120px;border-radius:20px;background:${hex};${dark ? `box-shadow:inset 0 0 0 2px ${T.line}` : ''}"></div>
        <p style="font-weight:600;font-size:20px">${name}</p>
        <p class="mono" style="color:${T.muted};font-size:16px">${hex}</p>
        <p style="color:${T.muted};font-size:15px;line-height:1.35">${use}</p>
      </div>`;
    await render(browser, `
      <div style="width:1600px;height:1100px;background:${T.night};padding:72px;display:grid;grid-template-columns:1fr 1fr;gap:64px">
        <div>
          <div style="display:flex;align-items:center;gap:20px"><img src="${icon}" width="88" height="88"><span class="display" style="font-size:56px;font-weight:800">LifeOS</span></div>
          <p class="mono" style="color:${T.marigold};letter-spacing:.24em;font-size:15px;margin-top:40px">HOJA DE MARCA · BITÁCORA DEL DÍA</p>
          <p style="font-size:22px;color:${T.muted};margin-top:16px;line-height:1.5;max-width:620px">El día como un reloj: las 24 horas en círculo, las tareas como arcos y una manecilla de cempasúchil que marca el ahora. El logo, el icono y el Resumen usan el mismo dibujo.</p>
          <div style="display:flex;gap:28px;align-items:flex-end;margin-top:48px">
            <img src="${icon}" width="160" height="160"><img src="${icon}" width="96" height="96"><img src="${icon}" width="48" height="48"><img src="${icon}" width="24" height="24">
          </div>
          <p style="font-size:15px;color:${T.muted};margin-top:14px">Icono de la app a 160, 96, 48 y 24 px. Deja alrededor un margen de al menos un cuarto de su ancho.</p>
          <div style="margin-top:56px;border-top:2px solid ${T.line};padding-top:36px;display:grid;gap:26px">
            <div><p class="display" style="font-size:64px;font-weight:800;line-height:1">Bricolage Grotesque</p><p style="color:${T.muted};font-size:16px;margin-top:6px">Títulos · con moderación</p></div>
            <div><p style="font-size:34px;font-weight:500">Figtree para todo el texto de la app</p><p style="color:${T.muted};font-size:16px;margin-top:6px">Texto · legible a cualquier tamaño</p></div>
            <div><p class="mono" style="font-size:40px;font-weight:600">$11,600 · 13:00–13:45</p><p style="color:${T.muted};font-size:16px;margin-top:6px">IBM Plex Mono · cifras, horas y montos</p></div>
          </div>
        </div>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:28px;align-content:start">
          ${swatch('Noche', T.night, 'Fondo de la app', true)}
          ${swatch('Tinta', T.card, 'Tarjetas y superficies', true)}
          ${swatch('Papel', '#edebf4', 'Texto principal')}
          ${swatch('Jacaranda', T.jacaranda, 'Acento: navegación, tareas, enlaces')}
          ${swatch('Cempasúchil', T.marigold, 'El ahora, rachas y foco')}
          ${swatch('Nopal', T.nopal, 'Ingresos y tareas hechas')}
          ${swatch('Granada', T.granada, 'Gastos excedidos y atrasos')}
          ${swatch('Agua', T.agua, 'Hidratación y repetición')}
          ${swatch('Jacaranda profunda', T.jacarandaDeep, 'Botones principales')}
        </div>
      </div>`, 1600, 1100, join(root, 'brand/hoja-de-marca.png'));
  } finally {
    await browser.close();
    server.kill();
  }
  writeFileSync(join(root, 'brand/README.md'), `# Kit de marca de LifeOS

Generado con \`npm run brand\` a partir de la app real (datos de ejemplo, sábado 14 de noviembre de 2026, 10:30).

| Archivo | Uso |
|---|---|
| \`../public/og-image.png\` | Vista previa al compartir el enlace (WhatsApp, redes, mensajes) |
| \`capturas/1-resumen.png\` … \`4-salud.png\` | Publicaciones, historias o tiendas de apps (1080×1920) |
| \`hoja-de-marca.png\` | Logo, colores y tipografía de un vistazo |

Las reglas completas están en [../DESIGN.md](../DESIGN.md).
`);
  console.log('Listo.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
