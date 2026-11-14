import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { contrast, readColorTokens } from './contrast.js';

// Revisa el contraste (WCAG) de las combinaciones de texto y fondo que usa la app,
// leyendo los colores directamente de src/index.css, en tema oscuro y claro.
// Si un cambio de color baja el contraste, esta prueba falla.

const css = readFileSync(new URL('../index.css', import.meta.url), 'utf8');
const block = (start) => {
  const i = css.indexOf(start);
  return css.slice(i, css.indexOf('\n}', i));
};
const dark = readColorTokens(block('@theme {'));
const light = { ...dark, ...readColorTokens(block(':root.light {')) };

// [texto, fondo, mínimo, uso]
// 4.5:1 = texto normal (WCAG AA) · 3:1 = texto grande, iconos y bordes de controles.
const PAIRS = [
  ['slate-100', 'slate-950', 4.5, 'texto principal sobre el fondo'],
  ['slate-100', 'slate-900', 4.5, 'texto principal en tarjetas'],
  ['slate-300', 'slate-900', 4.5, 'texto secundario en tarjetas'],
  ['slate-400', 'slate-900', 4.5, 'etiquetas y descripciones'],
  ['slate-400', 'slate-800', 4.5, 'etiquetas en filas y botones secundarios'],
  ['slate-500', 'slate-900', 4.5, 'texto secundario (fechas, leyendas, etiquetas, ejemplos de los campos)'],
  ['slate-500', 'slate-950', 4.5, 'texto secundario sobre el fondo'],
  ['slate-600', 'slate-900', 3, 'círculos de "sin marcar" y bordes de controles (WCAG 1.4.11)'],
  ['indigo-400', 'slate-900', 4.5, 'enlaces y horas'],
  ['emerald-400', 'slate-900', 4.5, 'montos de ingreso'],
  ['rose-400', 'slate-900', 4.5, 'montos de gasto y atrasos'],
  ['amber-400', 'slate-900', 4.5, 'etiquetas destacadas'],
  ['sky-400', 'slate-900', 3, 'iconos de agua y repetición'],
];

for (const [theme, tokens] of [['oscuro', dark], ['claro', light]]) {
  describe(`contraste en tema ${theme}`, () => {
    for (const [fg, bg, min, use] of PAIRS) {
      it(`${use}: ${fg} sobre ${bg} ≥ ${min}:1`, () => {
        expect(tokens[fg], `falta el color ${fg}`).toBeTruthy();
        expect(tokens[bg], `falta el color ${bg}`).toBeTruthy();
        expect(Number(contrast(tokens[fg], tokens[bg]).toFixed(2))).toBeGreaterThanOrEqual(min);
      });
    }

    it('texto blanco sobre botones principales (indigo-600) ≥ 4.5:1', () => {
      expect(contrast('#ffffff', tokens['indigo-600'])).toBeGreaterThanOrEqual(4.5);
    });
  });
}
