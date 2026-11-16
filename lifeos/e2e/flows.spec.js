import { test, expect, openApp, nav } from './fixtures.js';

// Flujos completos en el navegador, con fecha fija (sábado 14 de noviembre de 2026, 10:30).

const quickAdd = async (page, text) => {
  await page.getByLabel('Entrada rápida').fill(text);
  await page.getByLabel('Entrada rápida').press('Enter');
  return page.getByRole('status');
};

test.describe('entrada rápida', () => {
  test('agenda una tarea con fecha relativa y repetición', async ({ page }) => {
    await openApp(page);
    await expect(await quickAdd(page, 'Gym cada lunes 7am')).toContainText('Lun 16 de nov a las 07:00 · se repite: semanal');
    await nav(page, 'Agenda').click();
    await page.getByRole('button', { name: 'Semana', exact: true }).click();
    await page.getByRole('button', { name: 'Semana siguiente' }).click();
    await expect(page.locator('main').getByText('Gym')).toBeVisible();
  });

  test('registra un gasto en la categoría propia', async ({ page }) => {
    await openApp(page);
    await expect(await quickAdd(page, 'Uber al aeropuerto $350')).toContainText('$350 (Transporte)');
    await nav(page, 'Finanzas').click();
    await expect(page.getByText('Uber al aeropuerto')).toBeVisible();
  });

  test('suma vasos de agua', async ({ page }) => {
    await openApp(page);
    await quickAdd(page, '2 vasos de agua');
    await expect(page.getByRole('status')).toContainText('+2 vasos de agua');
    const water = () => page.evaluate(() => JSON.parse(localStorage.getItem('lifeos_data_v6')).health.water);
    await expect.poll(water).toBe(5); // 3 que ya había + 2
  });
});

test.describe('agenda', () => {
  test('completar una tarea que se repite crea la siguiente y desmarcarla la quita', async ({ page }) => {
    await openApp(page);
    await nav(page, 'Agenda').click();
    const gym = page.locator('main').getByRole('button', { name: /Entrenamiento de fuerza/ }).first();
    await gym.click();
    await page.getByRole('button', { name: 'Todas', exact: true }).click();
    await expect(page.getByText('Entrenamiento de fuerza', { exact: true })).toHaveCount(2);
    await page.locator('main button[aria-pressed="true"]', { hasText: 'Entrenamiento de fuerza' }).click();
    await expect(page.getByText('Entrenamiento de fuerza', { exact: true })).toHaveCount(1);
  });

  test('marca los choques de horario y las tareas atrasadas', async ({ page }) => {
    await openApp(page);
    await nav(page, 'Agenda').click();
    await expect(page.getByText('Choca con Dentista')).toBeVisible();
    await expect(page.getByText(/Atrasada · Jue 12 de nov/)).toBeVisible();
    await page.getByRole('button', { name: 'Mover a hoy: Pagar tarjeta de crédito' }).click();
    await expect(page.getByText(/Atrasada ·/)).toHaveCount(0);
  });

  test('no acepta una hora de fin antes del inicio', async ({ page }) => {
    await openApp(page);
    await nav(page, 'Agenda').click();
    await page.getByPlaceholder('¿Qué necesitas hacer?').first().fill('Clase');
    await page.getByLabel('Inicio').fill('18:00');
    await page.getByLabel('Fin (opcional)').fill('17:00');
    await page.getByRole('button', { name: 'Crear tarea' }).click();
    await expect(page.getByRole('status')).toContainText('La hora de fin debe ser después de la de inicio');
  });

  test('borrar y deshacer', async ({ page }) => {
    await openApp(page);
    await nav(page, 'Agenda').click();
    await page.getByRole('button', { name: 'Eliminar tarea: Dentista' }).click();
    await expect(page.getByRole('button', { name: 'Eliminar tarea: Dentista' })).toHaveCount(0);
    await page.getByRole('status').getByRole('button', { name: 'Deshacer' }).click();
    await expect(page.getByRole('button', { name: 'Eliminar tarea: Dentista' })).toHaveCount(1);
  });
});

test.describe('finanzas', () => {
  test('la tendencia cambia el periodo al tocar un mes', async ({ page }) => {
    await openApp(page);
    await nav(page, 'Finanzas').click();
    await page.locator('svg[aria-label^="Ingresos y gastos"] rect').nth(1).click();
    await expect(page.locator('main h2 + p')).toHaveText('Julio 2026');
  });

  test('avisa del presupuesto excedido', async ({ page }) => {
    await openApp(page);
    await nav(page, 'Finanzas').click();
    await expect(page.getByText(/Te pasaste por \$/)).toBeVisible();
  });

  test('renombrar una categoría actualiza movimientos y presupuestos', async ({ page }) => {
    await openApp(page);
    await nav(page, 'Ajustes').click();
    const input = page.getByLabel('Nombre de la categoría Ocio');
    await input.fill('Diversión');
    await input.press('Enter');
    await nav(page, 'Finanzas').click();
    await expect(page.getByText(/Diversión • /).first()).toBeVisible();
    await expect(page.getByText('Diversión', { exact: true }).first()).toBeVisible();
  });
});

test.describe('datos', () => {
  test('el tema y los cambios se conservan al recargar', async ({ page }) => {
    await openApp(page);
    await nav(page, 'Ajustes').click();
    await page.getByRole('button', { name: 'Claro' }).click();
    await quickAdd(page, 'Tarea que debe persistir');
    await page.reload();
    await expect(page.locator('html')).toHaveClass(/light/);
    await nav(page, 'Agenda').click();
    await expect(page.getByText('Tarea que debe persistir')).toBeVisible();
  });

  test.describe('sin datos guardados', () => {
    test.use({ seed: false });

    test('migra los datos de la versión 5', async ({ page }) => {
      await page.addInitScript(() => {
        if (localStorage.getItem('lifeos_data_v6')) return;
        localStorage.setItem('lifeos_tasks_v5', JSON.stringify([{ id: 'v5', title: 'Tarea de la versión 5', date: '2026-11-14', time: '09:00' }]));
        localStorage.setItem('lifeos_budgets_v5', JSON.stringify({ Ocio: 999 }));
      });
      await openApp(page);
      await nav(page, 'Agenda').click();
      await expect(page.getByText('Tarea de la versión 5')).toBeVisible();
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem('lifeos_data_v6')).budgets)).toEqual({ Ocio: 999 });
    });
  });
});

test('accesibilidad: botones y campos tienen nombre en todas las pantallas', async ({ page }) => {
  await openApp(page);
  const problems = [];
  for (const tab of ['Hoy (Resumen)', 'Finanzas', 'Salud y Hábitos', 'Agenda', 'Ajustes']) {
    await nav(page, tab).click();
    const found = await page.evaluate(() => {
      const name = (el) => (el.getAttribute('aria-label') || el.getAttribute('title') || el.textContent || '').trim()
        || (el.id && document.querySelector(`label[for="${el.id}"]`)?.textContent.trim())
        || el.closest('label')?.textContent.trim()
        || el.getAttribute('placeholder');
      return [...document.querySelectorAll('button, input:not([type=hidden]):not(.hidden), select, [role=button]')]
        .filter((el) => el.offsetParent !== null || el.closest('svg'))
        .filter((el) => !name(el))
        .map((el) => el.outerHTML.slice(0, 120));
    });
    problems.push(...found.map((html) => `${tab}: ${html}`));
  }
  expect(problems).toEqual([]);
});

test.describe('primera vez', () => {
  test.use({ seed: false });

  test('bienvenida: nombre, prueba de entrada rápida y empezar desde cero', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Tu día, en un solo vistazo.' })).toBeVisible();
    await page.getByPlaceholder('Tu nombre').fill('Ana');
    await page.getByRole('button', { name: 'Continuar' }).click();

    // La prueba usa la lógica real de la entrada rápida, sin guardar nada.
    await page.getByLabel('Prueba la entrada rápida').fill('Gym cada lunes 7am');
    await expect(page.getByText('Se repite: semanal')).toBeVisible();
    await page.getByRole('button', { name: 'Continuar' }).click();

    await page.getByRole('radio', { name: /Desde cero/ }).click();
    await page.getByRole('button', { name: 'Entrar a LifeOS' }).click();

    await expect(page.getByText('Buenos días, Ana.')).toBeVisible();
    await expect(page.getByText('Nada agendado para hoy.')).toBeVisible();
    await nav(page, 'Salud y Hábitos').click();
    await page.getByRole('button', { name: '+ Leer 20 minutos' }).click();
    await expect(page.locator('main button[aria-pressed]', { hasText: 'Leer 20 minutos' })).toBeVisible();

    // Al recargar ya no aparece la bienvenida.
    await page.reload();
    await expect(page.getByRole('heading', { name: 'LifeOS' })).toBeVisible();
  });

  test('bienvenida: con datos de ejemplo', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('button', { name: 'Saltar' }).click();
    await nav(page, 'Agenda').click();
    await expect(page.getByText('Preparar presentación de proyecto')).toBeVisible();
  });
});

test('ajustes: volver a ver la bienvenida sin perder datos', async ({ page }) => {
  await openApp(page);
  await nav(page, 'Ajustes').click();
  await page.getByRole('button', { name: 'Ver el recorrido de bienvenida' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page.getByRole('heading', { name: 'Eso es todo.' })).toBeVisible();
  await page.getByRole('button', { name: 'Entrar a LifeOS' }).click();
  await nav(page, 'Agenda').click();
  await expect(page.getByText('Dentista', { exact: true })).toBeVisible();
});

test('ajustes: borrar todo y deshacer', async ({ page }) => {
  await openApp(page);
  await nav(page, 'Ajustes').click();
  await page.getByRole('button', { name: 'Borrar todos los datos y empezar de cero' }).click();
  await page.getByRole('button', { name: 'Sí, borrar todo' }).click();
  await nav(page, 'Agenda').click();
  await expect(page.getByText('No hay tareas programadas para esta vista.')).toBeVisible();
  await page.getByRole('status').getByRole('button', { name: 'Deshacer' }).click();
  await expect(page.getByText('Dentista', { exact: true })).toBeVisible();
});

test('resumen: lo atrasado va en un solo grupo y se mueve a hoy con deshacer', async ({ page }) => {
  await openApp(page);
  await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('lifeos_data_v6'));
    d.tasks.push({ id: 'late-old', title: 'Renovar licencia', date: '2026-11-05', time: '', endTime: '', priority: 'low', repeat: 'none', completed: false, updatedAt: '2026-11-14T08:00:00.000Z' });
    localStorage.setItem('lifeos_data_v6', JSON.stringify(d));
  });
  await page.reload();
  const avisos = page.getByRole('list', { name: 'Avisos' });
  await avisos.getByRole('button', { name: /2 atrasadas, desde el jue 5 de nov/ }).click();
  // De la más antigua a la más reciente, y no se repiten en "Hoy, en orden".
  await expect(avisos.getByRole('button', { name: /^Mover a hoy:/ })).toHaveText(['Mover a hoy', 'Mover a hoy']);
  await expect(avisos.getByRole('button', { name: /^Mover a hoy:/ }).first()).toHaveAccessibleName('Mover a hoy: Renovar licencia');
  await expect(page.getByRole('region', { name: 'Hoy, en orden' }).getByText('Pagar tarjeta de crédito')).toHaveCount(0);

  await avisos.getByRole('button', { name: 'Mover todas a hoy' }).click();
  await expect(page.getByRole('status')).toContainText('2 tareas movidas a hoy');
  await expect(page.getByRole('region', { name: 'Hoy, en orden' }).getByText('Renovar licencia')).toBeVisible();
  await page.getByRole('status').getByRole('button', { name: 'Deshacer' }).click();
  await expect(avisos.getByRole('button', { name: /2 atrasadas/ })).toBeVisible();
});

test('resumen: el dinero dice su estado y el mes en negativo explica qué pasó', async ({ page }) => {
  await openApp(page);
  await expect(page.getByRole('list', { name: 'Avisos' })).toContainText('Ocio: te pasaste por $269 · límite $1,500 al mes');

  // Sin ingresos este mes: sugiere registrarlos en vez de mostrar "Te queda −$X".
  await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('lifeos_data_v6'));
    d.transactions = d.transactions.filter((t) => !(t.type === 'income' && t.date.startsWith('2026-11')));
    localStorage.setItem('lifeos_data_v6', JSON.stringify(d));
  });
  await page.reload();
  const dinero = page.getByRole('region', { name: /Dinero en/ });
  await expect(dinero.getByText('Gastaste de más')).toBeVisible();
  await expect(dinero.getByText('Te queda')).toHaveCount(0);
  await expect(dinero).toContainText('Aún no registras ingresos este mes');

  // Con ingresos menores a los gastos: dice cuánto y qué categoría pesa más.
  await page.evaluate(() => {
    const d = JSON.parse(localStorage.getItem('lifeos_data_v6'));
    d.transactions.push({ id: 'n1', desc: 'Nómina', amount: 2000, type: 'income', category: 'Salario', date: '2026-11-01', recurringId: null, updatedAt: '2026-11-14T08:00:00.000Z' });
    localStorage.setItem('lifeos_data_v6', JSON.stringify(d));
  });
  await page.reload();
  await expect(dinero).toContainText('Salió $5,699 más de lo que entró. Lo que más pesa: Alimentación, con $3,950.');
});

test('reloj con teclado: una parada de Tab, flechas, Enter lleva al botón y Esc vuelve', async ({ page }) => {
  await openApp(page);
  const arcs = page.locator('svg[role="group"] path[role="button"]');
  await expect(arcs).toHaveCount(4);
  await expect(page.locator('svg[role="group"] path[role="button"][tabindex="0"]')).toHaveCount(1);

  // El arco que recibe Tab es el de la siguiente tarea.
  const stop = page.locator('svg[role="group"] path[role="button"][tabindex="0"]');
  await stop.focus();
  await expect(page.locator(':focus')).toHaveAttribute('aria-label', /^Entrenamiento de fuerza/);
  await page.keyboard.press('ArrowRight');
  await expect(page.locator(':focus')).toHaveAttribute('aria-label', /^Dentista/);
  await page.keyboard.press('Enter');
  await expect(page.locator(':focus')).toHaveAccessibleName('Marcar como hecha: Dentista');
  await expect(page.getByText(/^Seleccionaste Dentista, 13:15/)).toBeAttached();
  const box = await page.locator(':focus').boundingBox();
  expect(box.height).toBeGreaterThanOrEqual(44);

  await page.keyboard.press('Escape');
  await expect(page.locator(':focus')).toHaveAttribute('aria-label', /^Dentista/);
  await expect(page.getByRole('button', { name: /Marcar como hecha/ })).toHaveCount(0);
});

test.describe('reloj: tareas encimadas y la noche', () => {
  const addTask = (page, task) => page.evaluate((t) => {
    const d = JSON.parse(localStorage.getItem('lifeos_data_v6'));
    d.tasks.push({ date: '2026-11-14', endTime: '', priority: 'low', repeat: 'none', completed: false, updatedAt: '2026-11-14T08:00:00.000Z', ...t });
    localStorage.setItem('lifeos_data_v6', JSON.stringify(d));
  }, task);
  const pressed = (page) => page.locator('svg[role="group"] path[aria-pressed="true"]');

  test('tocar varias veces el mismo punto recorre las tareas encimadas y luego suelta', async ({ page }) => {
    await openApp(page);
    await addTask(page, { id: 'c1', title: 'Llamar a mamá', time: '13:00' });
    await addTask(page, { id: 'c2', title: 'Pagar luz', time: '13:10' });
    await page.reload();
    const dentista = page.getByRole('button', { name: /^Dentista, 13:15/ });
    const seen = [];
    for (let i = 0; i < 4; i += 1) {
      await dentista.click({ force: true }); // el mismo punto, aunque otro arco quede encima
      seen.push((await pressed(page).getAttribute('aria-label')).split(',')[0]);
    }
    expect(seen).toEqual(['Dentista', 'Entrenamiento de fuerza', 'Llamar a mamá', 'Pagar luz']);
    await expect(page.getByText('3 de 4 a esta hora')).toBeVisible();
    await dentista.click({ force: true });
    await expect(pressed(page)).toHaveCount(0);

    // Tocar fuera del reloj también suelta la selección.
    await dentista.click({ force: true });
    await expect(pressed(page)).toHaveCount(1);
    await page.getByRole('heading', { name: 'Hoy, en orden' }).click();
    await expect(pressed(page)).toHaveCount(0);
  });

  test('de noche dice qué se pasó, lo marca punteado y lo mueve a mañana con deshacer', async ({ page }) => {
    await page.clock.setFixedTime(new Date('2026-11-14T21:40:00-06:00'));
    await openApp(page);
    await expect(page.getByRole('heading', { name: 'Se pasó la hora de 3 tareas' })).toBeVisible();
    await expect(page.locator('svg[role="group"]')).toHaveAttribute('aria-label', /se pasó la hora de 3 tareas sin marcar/);
    await expect(page.getByRole('button', { name: /^Dentista, 13:15, ya pasó la hora/ })).toHaveCount(1);
    await expect(page.locator('svg[role="group"] path[stroke-dasharray]')).toHaveCount(3);

    await page.getByRole('button', { name: 'Mover a mañana las 3 tareas' }).click();
    await expect(page.getByRole('status')).toContainText('3 tareas movidas a mañana');
    await expect(page.getByRole('heading', { name: 'Comprar regalo de cumpleaños' })).toBeVisible();
    await page.getByRole('status').getByRole('button', { name: 'Deshacer' }).click();
    await expect(page.getByRole('heading', { name: 'Se pasó la hora de 3 tareas' })).toBeVisible();
  });

  test('en celular el título va antes que el reloj también al leer y con Tab', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openApp(page);
    const order = await page.evaluate(() => {
      const h = document.getElementById('hoy-sigue');
      const dial = document.querySelector('svg[role="group"]');
      return Boolean(h.compareDocumentPosition(dial) & Node.DOCUMENT_POSITION_FOLLOWING);
    });
    expect(order).toBe(true);
  });
});

test('cambiar de sección abre desde arriba y lleva el foco al contenido', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 600 });
  await openApp(page);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await page.getByRole('button', { name: /Abrir agenda/ }).click();
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);
  await expect(page.locator('#contenido')).toBeFocused();
});

test.describe('celular: navegación inferior', () => {
  test.use({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });

  test('las 5 secciones caben abajo, se tocan con el pulgar y marcan la activa', async ({ page }) => {
    await openApp(page);
    const bar = page.getByRole('navigation', { name: 'Secciones' }).filter({ visible: true });
    const buttons = bar.getByRole('button');
    await expect(buttons).toHaveCount(5);
    const box = await bar.boundingBox();
    expect(box.y + box.height).toBeCloseTo(844, 0); // pegada al borde inferior
    for (const b of await buttons.all()) {
      const r = await b.boundingBox();
      expect(r.x).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width).toBeLessThanOrEqual(390); // sin desplazamiento lateral
      expect(r.height).toBeGreaterThanOrEqual(44);
    }
    await bar.getByRole('button', { name: 'Ajustes' }).click();
    await expect(bar.getByRole('button', { name: 'Ajustes' })).toHaveAttribute('aria-current', 'page');
    await expect(page.getByRole('heading', { name: 'Ajustes', level: 2 })).toBeVisible();

    // El final del contenido no queda tapado por la barra.
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    const last = await page.locator('main > *').last().boundingBox();
    const barTop = (await bar.boundingBox()).y;
    expect(last.y + last.height).toBeLessThanOrEqual(barTop);
  });

  test('el resumen cabe: avisos juntos y el +1 de agua a la vista sin desplazarse', async ({ page }) => {
    await openApp(page);
    const toggle = page.getByRole('button', { name: /2 cosas por atender/ });
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await expect(page.getByRole('list', { name: 'Avisos' })).toBeHidden();
    const water = await page.getByRole('button', { name: 'Sumar 1 vaso de agua' }).boundingBox();
    const barTop = (await page.getByRole('navigation', { name: 'Secciones' }).filter({ visible: true }).boundingBox()).y;
    expect(water.y + water.height).toBeLessThanOrEqual(barTop);
    await toggle.click();
    await expect(page.getByRole('list', { name: 'Avisos' }).getByText(/Ocio:/)).toBeVisible();
  });
});
