import { useState } from 'react';

// Gráficas pequeñas de 7 días: una medida por gráfica, un solo eje (nunca dos escalas juntas).
// Cada columna es un área de cursor más grande que la marca, con tooltip.

const W = 320;
const H = 140;
const PAD = { top: 16, right: 8, bottom: 22, left: 26 };
const plotW = W - PAD.left - PAD.right;
const plotH = H - PAD.top - PAD.bottom;

function Frame({ days, max, ticks, hover, setHover, children, tooltip, label }) {
  const colW = plotW / days.length;
  const y = (v) => PAD.top + plotH - (v / max) * plotH;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" role="img" aria-label={label}>
        {ticks.map((t) => (
          <g key={t}>
            <line x1={PAD.left} x2={W - PAD.right} y1={y(t)} y2={y(t)} className="stroke-slate-800" strokeWidth={1} />
            <text x={PAD.left - 6} y={y(t)} textAnchor="end" dominantBaseline="central" className="fill-slate-500 num" fontSize="9">{t}</text>
          </g>
        ))}
        {days.map((d, i) => (
          <text key={d.key} x={PAD.left + colW * i + colW / 2} y={H - 6} textAnchor="middle" fontSize="10"
            className={d.isToday ? 'fill-indigo-400 font-semibold' : hover === i ? 'fill-slate-200' : 'fill-slate-500'}>
            {d.day}
          </text>
        ))}
        {children({ colW, y })}
        {days.map((d, i) => (
          <rect
            key={`hit-${d.key}`} x={PAD.left + colW * i} y={PAD.top} width={colW} height={plotH} fill="transparent"
            onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)}
          />
        ))}
      </svg>
      {hover != null && (
        <div
          className="absolute -top-2 pointer-events-none -translate-x-1/2 -translate-y-full bg-slate-800 border border-slate-700 text-xs text-slate-100 rounded-lg px-2.5 py-1.5 shadow-lg whitespace-nowrap"
          style={{ left: `${((PAD.left + colW * hover + colW / 2) / W) * 100}%` }}
        >
          {tooltip(days[hover])}
        </div>
      )}
    </div>
  );
}

export function SleepChart({ days, goal = 8 }) {
  const [hover, setHover] = useState(null);
  const max = 10;
  return (
    <Frame
      days={days} max={max} ticks={[0, 4, 8]} hover={hover} setHover={setHover}
      label={`Horas de sueño de los últimos ${days.length} días`}
      tooltip={(d) => <><span className="text-slate-400">{d.day}</span> · <span className="num">{d.sleep == null ? 'sin registro' : `${d.sleep} h`}</span></>}
    >
      {({ colW: cw, y }) => (
        <>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(goal)} y2={y(goal)} className="stroke-amber-400/60" strokeDasharray="3 3" strokeWidth={1} />
          <text x={W - PAD.right} y={y(goal) - 5} textAnchor="end" fontSize="9" className="fill-amber-400">meta {goal} h</text>
          {days.map((d, i) => {
            if (d.sleep == null) {
              return <text key={d.key} x={PAD.left + cw * i + cw / 2} y={y(0) - 6} textAnchor="middle" fontSize="10" className="fill-slate-600">–</text>;
            }
            const barW = Math.min(18, cw * 0.5);
            const x = PAD.left + cw * i + (cw - barW) / 2;
            const top = y(Math.min(d.sleep, max));
            const h = y(0) - top;
            const r = Math.min(4, h);
            // Barra con extremo superior redondeado (4px) y base recta sobre el eje.
            return (
              <path
                key={d.key}
                d={`M${x},${y(0)} V${top + r} Q${x},${top} ${x + r},${top} H${x + barW - r} Q${x + barW},${top} ${x + barW},${top + r} V${y(0)} Z`}
                className={d.isToday ? 'fill-indigo-400' : hover === i ? 'fill-indigo-400' : 'fill-indigo-600'}
              />
            );
          })}
        </>
      )}
    </Frame>
  );
}

export function EnergyChart({ days }) {
  const [hover, setHover] = useState(null);
  const max = 5;
  return (
    <Frame
      days={days} max={max} ticks={[1, 3, 5]} hover={hover} setHover={setHover}
      label={`Nivel de energía de los últimos ${days.length} días`}
      tooltip={(d) => <><span className="text-slate-400">{d.day}</span> · <span className="num">{d.mood == null ? 'sin registro' : `${d.mood} de 5`}</span></>}
    >
      {({ colW: cw, y }) => {
        const pts = days.map((d, i) => (d.mood == null ? null : [PAD.left + cw * i + cw / 2, y(d.mood)]));
        // Línea solo entre días consecutivos con registro.
        const segments = [];
        pts.forEach((p, i) => { if (p && pts[i - 1]) segments.push([pts[i - 1], p]); });
        return (
          <>
            {segments.map(([a, b], i) => (
              <line key={i} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} className="stroke-amber-400" strokeWidth={2} strokeLinecap="round" />
            ))}
            {pts.map((p, i) => (p ? (
              <circle key={days[i].key} cx={p[0]} cy={p[1]} r={hover === i || days[i].isToday ? 5.5 : 4.5}
                className="fill-amber-400 stroke-slate-900" strokeWidth={2} />
            ) : (
              <text key={days[i].key} x={PAD.left + cw * i + cw / 2} y={y(0) - 6} textAnchor="middle" fontSize="10" className="fill-slate-600">–</text>
            )))}
          </>
        );
      }}
    </Frame>
  );
}
