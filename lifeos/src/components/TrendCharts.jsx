import { useState } from 'react';
import { formatReadableDate } from '../lib/dates.js';
import { formatMonth } from '../lib/finance.js';
import { niceMax, compactMoney, shortMonth } from '../lib/trends.js';
import { money } from './ui.jsx';

// ---------------------------------------------------------------------------
// Ingresos y gastos por mes: barras agrupadas sobre un solo eje (misma unidad).
// Pasar el cursor muestra el detalle; hacer clic selecciona ese mes como periodo.
// ---------------------------------------------------------------------------

const W = 640;
const H = 200;
const PAD = { top: 14, right: 8, bottom: 26, left: 44 };
const plotW = W - PAD.left - PAD.right;
const plotH = H - PAD.top - PAD.bottom;

// Barra con extremo superior redondeado (4px) y base recta sobre el eje.
const barPath = (x, top, width, base) => {
  const r = Math.min(4, (base - top) / 2, width / 2);
  return `M${x},${base} V${top + r} Q${x},${top} ${x + r},${top} H${x + width - r} Q${x + width},${top} ${x + width},${top + r} V${base} Z`;
};

const SERIES = [
  { key: 'income', label: 'Ingresos', color: 'var(--viz-income)' },
  { key: 'expense', label: 'Gastos', color: 'var(--viz-expense)' },
];

function Legend() {
  return (
    <div className="flex items-center gap-4 text-xs text-slate-300">
      {SERIES.map((s) => (
        <span key={s.key} className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-sm" style={{ background: s.color }} /> {s.label}
        </span>
      ))}
    </div>
  );
}

export function MonthlyTrend({ series, selected, onSelect }) {
  const [hover, setHover] = useState(null);
  const max = niceMax(Math.max(...series.flatMap((m) => [m.income, m.expense])));
  const y = (v) => PAD.top + plotH - (v / max) * plotH;
  const groupW = plotW / series.length;
  const barW = Math.min(22, groupW * 0.3);
  const shown = hover ?? series.findIndex((m) => m.month === selected);
  const detail = series[shown];

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <Legend />
        <p className="text-xs text-slate-400 min-h-4" aria-live="polite">
          {detail ? (
            <>
              <span className="text-slate-200">{formatMonth(detail.month)}</span>
              {' · '}ahorro{' '}
              <span className={`num ${detail.balance < 0 ? 'text-rose-400' : 'text-slate-200'}`}>
                {detail.balance < 0 ? '-' : ''}${money(Math.abs(detail.balance))}
              </span>
            </>
          ) : 'Toca un mes para verlo en detalle'}
        </p>
      </div>
      <div className="relative">
        <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={`Ingresos y gastos de los últimos ${series.length} meses`}>
          {[0, max / 2, max].map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="stroke-slate-800" strokeWidth={1} />
              <text x={PAD.left - 8} y={y(t)} textAnchor="end" dominantBaseline="central" className="fill-slate-500 num" fontSize="10">
                {compactMoney(t)}
              </text>
            </g>
          ))}
          {series.map((m, i) => {
            const cx = PAD.left + groupW * i + groupW / 2;
            const isSel = m.month === selected;
            const dim = shown >= 0 && shown !== i ? 0.45 : 1;
            return (
              <g key={m.month} style={{ opacity: dim }} className="transition-opacity">
                {SERIES.map((s, j) => {
                  const v = m[s.key];
                  if (!(v > 0)) return null;
                  // 2px de separación entre las dos barras del mes.
                  const x = j === 0 ? cx - barW - 1 : cx + 1;
                  return <path key={s.key} d={barPath(x, y(v), barW, y(0))} style={{ fill: s.color }} />;
                })}
                <text x={cx} y={H - 8} textAnchor="middle" fontSize="11" className={isSel ? 'fill-slate-100 font-semibold' : 'fill-slate-500'}>
                  {shortMonth(m.month)}
                </text>
              </g>
            );
          })}
          {series.map((m, i) => (
            <rect
              key={`hit-${m.month}`}
              x={PAD.left + groupW * i} y={PAD.top} width={groupW} height={plotH + PAD.bottom}
              fill="transparent" className="cursor-pointer"
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
              onClick={() => onSelect(m.month)}
            >
              <title>{`${formatMonth(m.month)} — ingresos $${money(m.income)}, gastos $${money(m.expense)}`}</title>
            </rect>
          ))}
        </svg>
        {hover != null && (
          <div
            className="absolute top-0 -translate-x-1/2 pointer-events-none bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs shadow-lg whitespace-nowrap"
            style={{ left: `${((PAD.left + groupW * hover + groupW / 2) / W) * 100}%` }}
          >
            <p className="font-semibold text-slate-100 mb-1">{formatMonth(series[hover].month)}</p>
            {SERIES.map((s) => (
              <p key={s.key} className="flex items-center gap-2 text-slate-300">
                <span className="w-2 h-2 rounded-sm" style={{ background: s.color }} />
                {s.label} <span className="num text-slate-100 ml-auto pl-3">${money(series[hover][s.key])}</span>
              </p>
            ))}
          </div>
        )}
      </div>
      {/* Tabla equivalente para lectores de pantalla */}
      <table className="sr-only">
        <caption>Ingresos y gastos por mes</caption>
        <thead><tr><th>Mes</th><th>Ingresos</th><th>Gastos</th><th>Ahorro</th></tr></thead>
        <tbody>
          {series.map((m) => (
            <tr key={m.month}><td>{formatMonth(m.month)}</td><td>${money(m.income)}</td><td>${money(m.expense)}</td><td>${money(m.balance)}</td></tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Constancia de hábitos: calendario de semanas (lunes a domingo) con escala de un tono.
// ---------------------------------------------------------------------------

const DAY_LABELS = ['L', '', 'X', '', 'V', '', 'D'];
const LEVEL_TEXT = ['ningún hábito', 'algunos hábitos', 'la mitad', 'casi todos', 'todos los hábitos'];

const cellStyle = (level) => (level == null ? undefined : { background: `var(--heat-${level})` });

export function HabitHeatmap({ calendar }) {
  const [hover, setHover] = useState(null);
  const days = calendar.flat().filter((d) => !d.future);
  const registered = days.filter((d) => d.level != null);
  const perfect = registered.filter((d) => d.level === 4).length;

  // Nombre del mes en la semana donde empieza, con al menos 3 semanas entre etiquetas.
  const starts = calendar.map((week, i) => {
    const first = week.find((d) => d.date.endsWith('-01'));
    return first ? first.date.slice(0, 7) : i === 0 ? week[0].date.slice(0, 7) : null;
  });
  let lastLabel = -3;
  const monthLabels = starts.map((month, i) => {
    if (!month) return '';
    const nextStart = starts.findIndex((m, j) => j > i && m);
    if (i === 0 && nextStart !== -1 && nextStart < 3) return ''; // la semana 0 cede a un mes que empieza pronto
    if (i - lastLabel < 3) return '';
    lastLabel = i;
    return shortMonth(month);
  });

  const describe = (d) => (d.level == null
    ? `${formatReadableDate(d.date)} · sin registro`
    : `${formatReadableDate(d.date)} · ${d.done} de ${d.total} hábitos`);

  return (
    <div>
      <div className="overflow-x-auto">
        <div className="inline-grid gap-[3px] [--cell:14px] sm:[--cell:18px] lg:[--cell:22px]" style={{ gridTemplateColumns: `1rem repeat(${calendar.length}, var(--cell))` }}>
          <span />
          {monthLabels.map((label, i) => (
            <span key={`m-${calendar[i][0].date}`} className="text-[10px] text-slate-500 leading-none h-3 whitespace-nowrap overflow-visible">{label}</span>
          ))}
          {DAY_LABELS.map((label, row) => (
            <div key={`row-${row}`} className="contents">
              <span className="text-[10px] text-slate-500 leading-[var(--cell)]">{label}</span>
              {calendar.map((week) => {
                const d = week[row];
                if (d.future) return <span key={d.date} className="w-[var(--cell)] h-[var(--cell)]" />;
                return (
                  <span
                    key={d.date}
                    title={describe(d)}
                    onMouseEnter={() => setHover(d)}
                    onMouseLeave={() => setHover(null)}
                    className={`w-[var(--cell)] h-[var(--cell)] rounded-[4px] ${d.level == null ? 'border border-slate-800' : ''} ${d.isToday ? 'ring-2 ring-amber-400 ring-offset-1 ring-offset-slate-900' : ''}`}
                    style={cellStyle(d.level)}
                  />
                );
              })}
            </div>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3 mt-4">
        <p className="text-xs text-slate-400 min-h-4" aria-live="polite">
          {hover
            ? describe(hover)
            : registered.length <= 1
              ? 'Cada día que cierres aparecerá aquí, más intenso cuantos más hábitos cumplas.'
              : `${perfect} ${perfect === 1 ? 'día' : 'días'} con todos los hábitos en ${registered.length} registrados`}
        </p>
        <div className="flex items-center gap-1.5 text-[11px] text-slate-500" aria-hidden="true">
          Ninguno
          {[0, 1, 2, 3, 4].map((l) => <span key={l} className="w-[12px] h-[12px] rounded-[3px]" style={cellStyle(l)} />)}
          Todos
        </div>
      </div>

      <p className="sr-only">
        {`Constancia de hábitos de las últimas ${calendar.length} semanas: ${perfect} días con todos los hábitos, `}
        {`${registered.filter((d) => d.level === 0).length} días sin ninguno, de ${registered.length} días registrados.`}
        {registered.slice(-7).map((d) => ` ${formatReadableDate(d.date)}: ${LEVEL_TEXT[d.level]}.`).join('')}
      </p>
    </div>
  );
}
