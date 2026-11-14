import { useState } from 'react';
import { isTime, timeToMinutes } from '../lib/dates.js';
import { formatTimeRange } from '../lib/agenda.js';

// Reloj del día: las 24 horas como un círculo (medianoche arriba), cada tarea con hora
// como un arco y una manecilla para el momento actual. Las tareas que se enciman van en
// un segundo carril, así los choques se ven a simple vista.
// El centro muestra la siguiente tarea, o la que estés señalando con el cursor o el teclado.

const MIN_ARC = 25; // minutos: una tarea sin hora de fin se dibuja con este largo
const GAP = 3; // minutos de separación entre arcos contiguos

const polar = (cx, minutes, radius) => {
  const a = (minutes / 1440) * 2 * Math.PI - Math.PI / 2;
  return [cx + radius * Math.cos(a), cx + radius * Math.sin(a)];
};

const arcPath = (cx, start, end, radius) => {
  const [x1, y1] = polar(cx, start, radius);
  const [x2, y2] = polar(cx, end, radius);
  const large = end - start > 720 ? 1 : 0;
  return `M ${x1.toFixed(2)} ${y1.toFixed(2)} A ${radius} ${radius} 0 ${large} 1 ${x2.toFixed(2)} ${y2.toFixed(2)}`;
};

const inMinutes = (mins) => {
  if (mins < 60) return `en ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `en ${h} h ${m} min` : `en ${h} h`;
};

export default function DayDial({ tasks, nowMinutes, size = 248 }) {
  const [focusId, setFocusId] = useState(null);
  const cx = size / 2;
  const outer = cx - 22;
  const inner = outer - 17;
  const stroke = 12;

  // Carriles: una tarea que se encima con otra del carril exterior pasa al interior.
  const timed = tasks
    .filter((t) => isTime(t.time))
    .map((t) => {
      const start = timeToMinutes(t.time);
      const end = isTime(t.endTime) && timeToMinutes(t.endTime) > start ? timeToMinutes(t.endTime) : Math.min(start + MIN_ARC, 1440);
      return { task: t, start, end };
    })
    .sort((a, b) => a.start - b.start);
  let outerEnd = -1;
  for (const item of timed) {
    item.lane = item.start < outerEnd ? 1 : 0;
    if (item.lane === 0) outerEnd = item.end;
  }
  const untimed = tasks.length - timed.length;
  const unchecked = timed.filter((i) => !i.task.completed).length;

  const next = nowMinutes == null
    ? timed.find((i) => !i.task.completed)
    : timed.find((i) => !i.task.completed && i.end > nowMinutes);
  const shown = timed.find((i) => i.task.id === focusId) || next;

  let centerLabel = 'Siguiente';
  if (shown && shown !== next) centerLabel = shown.task.completed ? 'Hecha' : 'Tarea';
  else if (shown && nowMinutes != null && shown.start <= nowMinutes) centerLabel = 'Ahora';
  const when = shown && shown === next && nowMinutes != null && shown.start > nowMinutes ? inMinutes(shown.start - nowMinutes) : null;

  const summary = timed.length
    ? `${timed.length} ${timed.length === 1 ? 'tarea' : 'tareas'} con hora hoy${next ? `; la siguiente es ${next.task.title} a las ${next.task.time}` : '; todas hechas'}.`
    : 'Hoy no hay tareas con hora.';

  return (
    <div className="relative shrink-0 mx-auto" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} width={size} height={size} role="img" aria-label={summary}>
        {/* Pista del día */}
        <circle cx={cx} cy={cx} r={outer} fill="none" className="stroke-slate-800" strokeWidth={stroke} />
        <circle cx={cx} cy={cx} r={inner} fill="none" className="stroke-slate-800/50" strokeWidth={stroke - 4} />

        {/* Horas: marcas cada hora, número cada 6 */}
        {Array.from({ length: 24 }, (_, h) => {
          const major = h % 6 === 0;
          const [x1, y1] = polar(cx, h * 60, outer + stroke / 2 + 3);
          const [x2, y2] = polar(cx, h * 60, outer + stroke / 2 + (major ? 9 : 6));
          return <line key={h} x1={x1} y1={y1} x2={x2} y2={y2} className={major ? 'stroke-slate-400' : 'stroke-slate-700'} strokeWidth={major ? 2 : 1} strokeLinecap="round" />;
        })}
        {[0, 6, 12, 18].map((h) => {
          const [x, y] = polar(cx, h * 60, inner - 17);
          return (
            <text key={h} x={x} y={y} textAnchor="middle" dominantBaseline="central" className="fill-slate-500 num" fontSize="10">
              {String(h).padStart(2, '0')}
            </text>
          );
        })}

        {/* Lo que va del día */}
        {nowMinutes != null && nowMinutes > 0 && (
          <path d={arcPath(cx, 0, Math.max(nowMinutes, 1), inner - 9)} fill="none" className="stroke-amber-400/35" strokeWidth={2} strokeLinecap="round" />
        )}

        {/* Tareas */}
        {timed.map((item) => {
          const radius = item.lane ? inner : outer;
          const start = item.start + GAP / 2;
          const end = Math.max(item.end - GAP / 2, start + 4);
          const active = focusId === item.task.id || (!focusId && next === item);
          const tone = item.task.completed ? 'stroke-emerald-500/70' : 'stroke-indigo-400';
          return (
            <path
              key={item.task.id}
              d={arcPath(cx, start, end, radius)}
              fill="none"
              className={`${tone} cursor-pointer transition-[stroke-width] outline-none`}
              strokeWidth={active ? stroke + 4 : item.lane ? stroke - 4 : stroke}
              strokeLinecap="butt"
              tabIndex={0}
              role="button"
              aria-label={`${item.task.title}, ${formatTimeRange(item.task)}${item.task.completed ? ', hecha' : ''}`}
              onMouseEnter={() => setFocusId(item.task.id)}
              onMouseLeave={() => setFocusId(null)}
              onFocus={() => setFocusId(item.task.id)}
              onBlur={() => setFocusId(null)}
            >
              <title>{`${formatTimeRange(item.task)} · ${item.task.title}`}</title>
            </path>
          );
        })}

        {/* Manecilla del ahora */}
        {nowMinutes != null && (() => {
          const [x1, y1] = polar(cx, nowMinutes, inner - 7);
          const [x2, y2] = polar(cx, nowMinutes, outer + stroke / 2 + 2);
          return (
            <g aria-hidden="true">
              <line x1={x1} y1={y1} x2={x2} y2={y2} className="stroke-amber-400" strokeWidth={2.5} strokeLinecap="round" />
              <circle cx={x2} cy={y2} r={4.5} className="fill-amber-400 stroke-slate-900" strokeWidth={2} />
            </g>
          );
        })()}
      </svg>

      {/* Centro: siguiente tarea o la señalada */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" aria-live="polite">
        <div className="text-center px-3" style={{ maxWidth: inner * 1.25 }}>
          {shown ? (
            <>
              <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-amber-400">{centerLabel}</p>
              <p className="num text-lg font-semibold text-slate-50 leading-tight mt-0.5">{formatTimeRange(shown.task)}</p>
              <p className="text-xs text-slate-300 leading-snug mt-1 line-clamp-2">{shown.task.title}</p>
              {when && <p className="text-[11px] text-slate-500 mt-1">{when}</p>}
            </>
          ) : (
            <>
              <p className="text-[10px] uppercase tracking-[0.18em] font-semibold text-amber-400">
                {!timed.length ? 'Día libre' : unchecked ? 'Pendiente' : 'Todo hecho'}
              </p>
              <p className="text-xs text-slate-400 leading-snug mt-1">
                {!timed.length
                  ? 'Agenda algo con hora para verlo aquí'
                  : unchecked
                    ? `${unchecked} ${unchecked === 1 ? 'tarea de antes sin marcar' : 'tareas de antes sin marcar'}`
                    : 'No quedan tareas con hora hoy'}
              </p>
            </>
          )}
          {untimed > 0 && <p className="text-[10px] text-slate-500 mt-1.5">+{untimed} sin hora</p>}
        </div>
      </div>
    </div>
  );
}
