import { useState } from 'react';
import { Check, Undo2 } from 'lucide-react';
import { isTime, timeToMinutes } from '../lib/dates.js';
import { formatTimeRange } from '../lib/agenda.js';

// Reloj del día: las 24 horas como un círculo (medianoche arriba), cada tarea con hora
// como un arco y una manecilla para el momento actual. Las tareas que se enciman van en
// un segundo carril, así los choques se ven a simple vista.
// El centro muestra la siguiente tarea. Tocar un arco (o enfocarlo y pulsar Enter) lo
// selecciona y permite marcarlo como hecho desde el centro.

const SIZE = 264; // unidades del dibujo; el tamaño en pantalla lo da CSS
const MIN_ARC = 25; // minutos: una tarea sin hora de fin se dibuja con este largo
const GAP = 3; // minutos de separación entre arcos contiguos
const HIT = 30; // grosor de la zona táctil invisible de cada arco

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

export default function DayDial({ tasks, nowMinutes, onToggleTask }) {
  const [hoverId, setHoverId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [focusId, setFocusId] = useState(null);
  const cx = SIZE / 2;
  const stroke = 12;
  const outer = cx - 36; // margen para las marcas y los números de las horas
  const inner = outer - 17;

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
  const selected = timed.find((i) => i.task.id === selectedId);
  // El título del Resumen ya dice qué sigue: el centro solo muestra una tarea cuando se señala o se toca.
  const shown = timed.find((i) => i.task.id === hoverId) || selected;
  const clock = nowMinutes == null ? null : `${String(Math.floor(nowMinutes / 60)).padStart(2, '0')}:${String(nowMinutes % 60).padStart(2, '0')}`;

  let centerLabel = 'Siguiente';
  if (shown && shown !== next) centerLabel = shown.task.completed ? 'Hecha' : 'Tarea';
  else if (shown && nowMinutes != null && shown.start <= nowMinutes) centerLabel = 'Ahora';
  const when = shown && shown === next && nowMinutes != null && shown.start > nowMinutes ? inMinutes(shown.start - nowMinutes) : null;

  const summary = timed.length
    ? `Reloj del día: ${timed.length} ${timed.length === 1 ? 'tarea' : 'tareas'} con hora${next ? `; la siguiente es ${next.task.title} a las ${next.task.time}` : '; todas hechas'}.`
    : 'Reloj del día: hoy no hay tareas con hora.';

  const select = (id) => setSelectedId((cur) => (cur === id ? null : id));

  return (
    <div className="relative shrink-0 mx-auto aspect-square w-[min(80vw,300px)] lg:w-[272px]">
      <svg viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full h-full" role="group" aria-label={summary}>
        {/* Pista del día */}
        <circle cx={cx} cy={cx} r={outer} fill="none" className="stroke-slate-800" strokeWidth={stroke} />
        <circle cx={cx} cy={cx} r={inner} fill="none" className="stroke-slate-800/50" strokeWidth={stroke - 4} />

        {/* Horas: marca cada hora y número cada 6, fuera del anillo */}
        <g aria-hidden="true">
          {Array.from({ length: 24 }, (_, h) => {
            const major = h % 6 === 0;
            const [x1, y1] = polar(cx, h * 60, outer + stroke / 2 + 3);
            const [x2, y2] = polar(cx, h * 60, outer + stroke / 2 + (major ? 9 : 6));
            return <line key={h} x1={x1} y1={y1} x2={x2} y2={y2} className={major ? 'stroke-slate-400' : 'stroke-slate-600'} strokeWidth={major ? 2 : 1} strokeLinecap="round" />;
          })}
          {[0, 6, 12, 18].map((h) => {
            const [x, y] = polar(cx, h * 60, outer + stroke / 2 + 20);
            return (
              <text key={h} x={x} y={y} textAnchor="middle" dominantBaseline="central" className="fill-slate-400 num" fontSize="12">
                {String(h).padStart(2, '0')}
              </text>
            );
          })}
        </g>

        {/* Lo que va del día */}
        {nowMinutes != null && nowMinutes > 0 && (
          <path d={arcPath(cx, 0, Math.max(nowMinutes, 1), inner - 9)} fill="none" className="stroke-amber-400/50" strokeWidth={2} strokeLinecap="round" aria-hidden="true" />
        )}

        {/* Tareas: arco visible + zona táctil invisible y enfocable */}
        {timed.map((item) => {
          const radius = item.lane ? inner : outer;
          const start = item.start + GAP / 2;
          const end = Math.max(item.end - GAP / 2, start + 4);
          const d = arcPath(cx, start, end, radius);
          const active = item.task.id === hoverId || item.task.id === selectedId || (!hoverId && !selectedId && next === item);
          const tone = item.task.completed ? 'stroke-emerald-500/70' : 'stroke-indigo-400';
          const width = active ? stroke + 4 : item.lane ? stroke - 4 : stroke;
          return (
            <g key={item.task.id}>
              {focusId === item.task.id && (
                <path d={d} fill="none" className="stroke-amber-400" strokeWidth={width + 6} strokeLinecap="round" aria-hidden="true" />
              )}
              <path d={d} fill="none" className={`${tone} transition-[stroke-width]`} strokeWidth={width} strokeLinecap="butt" pointerEvents="none" aria-hidden="true" />
              <path
                d={d}
                fill="none"
                stroke="transparent"
                strokeWidth={HIT}
                pointerEvents="stroke"
                className="cursor-pointer outline-none"
                tabIndex={0}
                role="button"
                aria-pressed={item.task.id === selectedId}
                aria-label={`${item.task.title}, ${formatTimeRange(item.task)}${item.task.completed ? ', hecha' : ''}`}
                onClick={() => select(item.task.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    select(item.task.id);
                  }
                }}
                onMouseEnter={() => setHoverId(item.task.id)}
                onMouseLeave={() => setHoverId(null)}
                // Contorno solo con teclado (:focus-visible), no al tocar o hacer clic.
                onFocus={(e) => setFocusId(e.currentTarget.matches(':focus-visible') ? item.task.id : null)}
                onBlur={() => setFocusId(null)}
              >
                <title>{`${formatTimeRange(item.task)} · ${item.task.title}`}</title>
              </path>
            </g>
          );
        })}

        {/* Manecilla del ahora */}
        {nowMinutes != null && (() => {
          const [x1, y1] = polar(cx, nowMinutes, inner - 7);
          const [x2, y2] = polar(cx, nowMinutes, outer + stroke / 2 + 2);
          return (
            <g aria-hidden="true" pointerEvents="none">
              <line x1={x1} y1={y1} x2={x2} y2={y2} className="stroke-amber-400" strokeWidth={2.5} strokeLinecap="round" />
              <circle cx={x2} cy={y2} r={4.5} className="fill-amber-400 stroke-slate-900" strokeWidth={2} />
            </g>
          );
        })()}
      </svg>

      {/* Centro: siguiente tarea o la seleccionada */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="text-center" style={{ maxWidth: `${((inner * 1.62) / SIZE) * 100}%` }}>
          {shown ? (
            <>
              <p className="text-xs uppercase tracking-[0.14em] font-semibold text-amber-400">{centerLabel}</p>
              <p className="num text-lg font-semibold text-slate-50 leading-tight mt-0.5">{formatTimeRange(shown.task)}</p>
              <p className="text-sm text-slate-200 leading-snug mt-1 line-clamp-2 hyphens-auto">{shown.task.title}</p>
              {when && <p className="text-xs text-slate-400 mt-1">{when}</p>}
              {selected && shown === selected && onToggleTask && (
                <button
                  type="button"
                  onClick={() => onToggleTask(selected.task.id)}
                  className="pointer-events-auto mt-2 inline-flex items-center gap-1.5 whitespace-nowrap text-xs font-semibold px-3 min-h-9 rounded-full bg-indigo-600 text-white hover:bg-indigo-500"
                >
                  {selected.task.completed
                    ? <><Undo2 className="w-3.5 h-3.5" aria-hidden="true" /> Desmarcar</>
                    : <><Check className="w-3.5 h-3.5" aria-hidden="true" /> Marcar como hecha</>}
                </button>
              )}
            </>
          ) : clock ? (
            <>
              <p className="text-xs uppercase tracking-[0.14em] font-semibold text-amber-400">Ahora</p>
              <p className="num text-3xl font-semibold text-slate-50 leading-none mt-1">{clock}</p>
              {timed.length > 0 && <p className="text-xs text-slate-400 mt-2">Toca un arco para ver la tarea</p>}
            </>
          ) : (
            <>
              <p className="text-xs uppercase tracking-[0.14em] font-semibold text-amber-400">
                {!timed.length ? 'Día libre' : unchecked ? 'Hoy' : 'Todo hecho'}
              </p>
              <p className="text-sm text-slate-300 leading-snug mt-1">
                {!timed.length
                  ? 'Agenda algo con hora para verlo aquí'
                  : unchecked
                    ? `${unchecked} ${unchecked === 1 ? 'tarea con hora por hacer' : 'tareas con hora por hacer'}`
                    : 'No quedan tareas con hora hoy'}
              </p>
            </>
          )}
          {untimed > 0 && <p className="text-xs text-slate-400 mt-1.5">+{untimed} sin hora</p>}
        </div>
      </div>
    </div>
  );
}
