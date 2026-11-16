import { useState, useRef, useEffect } from 'react';
import { Check, Undo2, HelpCircle } from 'lucide-react';
import { isTime, timeToMinutes } from '../lib/dates.js';
import { formatTimeRange } from '../lib/agenda.js';

// Reloj del día: las 24 horas como un círculo (medianoche arriba), cada tarea con hora
// como un arco y una manecilla para el momento actual. Las tareas que se enciman van en
// un segundo carril, así los choques se ven a simple vista.
// El centro muestra la tarea que se toca o se elige, con su botón para marcarla.
//
// Toque: tocar un arco (o cerca de él) elige esa tarea. Si varias tareas se enciman,
// cada toque pasa a la siguiente del grupo ("2 de 3"). Tocar fuera del reloj quita la
// selección.
// Teclado: el reloj es una sola parada de Tab; las flechas recorren las tareas en orden,
// Enter las selecciona y lleva al botón del centro, y Esc quita la selección.
// Estados, sin depender solo del color: por hacer (arco grueso), hecha (arco delgado y
// verde) y "se pasó la hora" (arco punteado).

const SIZE = 264; // unidades del dibujo; el tamaño en pantalla lo da CSS
const MIN_ARC = 25; // minutos: una tarea sin hora de fin dura esto
const MIN_DRAW = 15; // unidades: largo mínimo de un arco dibujado, para que se vea y se toque
const GAP = 3; // minutos de separación entre arcos contiguos
const HIT = 30; // grosor de la zona táctil invisible de cada arco
const NEAR = 40; // minutos: un toque en el anillo a esta distancia de una tarea la elige

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

// Minutos que ocupa un largo dado en un radio dado.
const minutesFor = (length, radius) => (length / radius) * (1440 / (2 * Math.PI));

const inMinutes = (mins) => {
  if (mins < 60) return `en ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `en ${h} h ${m} min` : `en ${h} h`;
};

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

export default function DayDial({ tasks, nowMinutes, onToggleTask }) {
  const [hoverId, setHoverId] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [focusId, setFocusId] = useState(null);
  const [activeId, setActiveId] = useState(null); // último arco enfocado (tabindex itinerante)
  const [announce, setAnnounce] = useState('');
  const wrapRef = useRef(null);
  const svgRef = useRef(null);
  const arcRefs = useRef({});
  const buttonRef = useRef(null);
  const focusButton = useRef(false);
  const cx = SIZE / 2;
  const stroke = 12;
  const outer = cx - 36; // margen para las marcas y los números de las horas
  const inner = outer - 17;

  // Cada tarea con su duración real (start/end) y su largo dibujado (drawEnd), que nunca
  // baja de MIN_DRAW para que una tarea corta se vea y se pueda tocar en el celular.
  const timed = tasks
    .filter((t) => isTime(t.time))
    .map((t) => {
      const start = timeToMinutes(t.time);
      const end = isTime(t.endTime) && timeToMinutes(t.endTime) > start ? timeToMinutes(t.endTime) : Math.min(start + MIN_ARC, 1440);
      return { task: t, start, end };
    })
    .sort((a, b) => a.start - b.start);

  // Carriles: una tarea que se encima con otra del carril exterior pasa al interior.
  // Grupos: tareas que se enciman entre sí (aunque sea en cadena) forman un grupo.
  let outerEnd = -1;
  let groupEnd = -1;
  const groups = [];
  for (const item of timed) {
    item.lane = item.start < outerEnd ? 1 : 0;
    const radius = item.lane ? inner : outer;
    item.drawEnd = Math.min(Math.max(item.end, item.start + minutesFor(MIN_DRAW, radius) + GAP), 1440);
    if (item.lane === 0) outerEnd = item.drawEnd;
    if (item.start >= groupEnd) groups.push([]);
    groups[groups.length - 1].push(item);
    item.group = groups[groups.length - 1];
    groupEnd = Math.max(groupEnd, item.drawEnd);
    item.missed = nowMinutes != null && !item.task.completed && item.end <= nowMinutes;
  }

  // Solo las que faltan: una tarea sin hora ya hecha no necesita aviso.
  const untimed = tasks.filter((t) => !isTime(t.time) && !t.completed).length;
  const unchecked = timed.filter((i) => !i.task.completed).length;
  const missed = timed.filter((i) => i.missed).length;
  const upcoming = unchecked - missed;

  const next = nowMinutes == null
    ? timed.find((i) => !i.task.completed)
    : timed.find((i) => !i.task.completed && i.end > nowMinutes);
  const selected = timed.find((i) => i.task.id === selectedId);
  const shown = timed.find((i) => i.task.id === hoverId) || selected;

  let centerLabel = 'Tarea';
  if (shown?.missed) centerLabel = 'Se pasó la hora';
  else if (shown?.task.completed) centerLabel = 'Hecha';
  else if (shown && shown === next) centerLabel = nowMinutes != null && shown.start <= nowMinutes ? 'Ahora' : 'Siguiente';
  const when = shown && shown === next && nowMinutes != null && shown.start > nowMinutes ? inMinutes(shown.start - nowMinutes) : null;
  const position = shown && shown.group.length > 1 ? `${shown.group.indexOf(shown) + 1} de ${shown.group.length} a esta hora` : null;

  let summary = 'Reloj del día: hoy no hay tareas con hora.';
  if (timed.length) {
    const state = next
      ? `la siguiente es ${next.task.title} a las ${next.task.time}`
      : missed ? `se pasó la hora de ${plural(missed, 'tarea sin marcar', 'tareas sin marcar')}` : 'todas hechas';
    summary = `Reloj del día: ${plural(timed.length, 'tarea', 'tareas')} con hora; ${state}. Usa las flechas para recorrerlas.`;
  }

  // Solo un arco recibe Tab: el último enfocado, el seleccionado, el siguiente o el primero.
  const has = (id) => timed.some((i) => i.task.id === id);
  const tabStop = [activeId, selectedId, next?.task.id, timed[0]?.task.id].find((id) => id && has(id));

  const choose = (item, { fromKeyboard = false } = {}) => {
    setSelectedId(item ? item.task.id : null);
    setAnnounce(item
      ? `Seleccionaste ${item.task.title}, ${formatTimeRange(item.task)}${item.task.completed ? ', hecha' : item.missed ? ', ya pasó la hora' : ''}${item.group.length > 1 ? `; ${item.group.indexOf(item) + 1} de ${item.group.length} a esta hora` : ''}.`
      : 'Sin tarea seleccionada.');
    focusButton.current = Boolean(item) && fromKeyboard;
  };

  // Un toque en un grupo: si nada del grupo está elegido, elige la tarea tocada;
  // si ya hay una elegida, pasa a la siguiente del grupo (dando la vuelta) y, al volver
  // a la primera que se tocó, suelta.
  const tapStart = useRef(null);
  const tap = (item) => {
    const { group } = item;
    const current = group.findIndex((i) => i.task.id === selectedId);
    if (current === -1) {
      tapStart.current = item.task.id;
      return choose(item);
    }
    const following = group[(current + 1) % group.length];
    if (group.length === 1 || following.task.id === tapStart.current) return choose(null);
    return choose(following);
  };

  const clear = (returnFocus) => {
    if (!selectedId) return;
    const id = selectedId;
    choose(null);
    if (returnFocus) arcRefs.current[id]?.focus();
  };

  // Con teclado, al seleccionar el foco pasa al botón del centro.
  useEffect(() => {
    if (focusButton.current && buttonRef.current) {
      buttonRef.current.focus();
      focusButton.current = false;
    }
  }, [selectedId]);

  // Tocar o hacer clic fuera del reloj quita la selección.
  useEffect(() => {
    if (!selectedId) return undefined;
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) {
        setSelectedId(null);
        setAnnounce('Sin tarea seleccionada.');
      }
    };
    document.addEventListener('pointerdown', onDown);
    return () => document.removeEventListener('pointerdown', onDown);
  }, [selectedId]);

  // Toque en el anillo pero fuera de los arcos: elige la tarea más cercana en el tiempo.
  const nearest = (e) => {
    const svg = svgRef.current;
    if (!svg || !timed.length) return null;
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const p = pt.matrixTransform(svg.getScreenCTM().inverse());
    const minutes = (((Math.atan2(p.y - cx, p.x - cx) + Math.PI / 2) / (2 * Math.PI)) * 1440 + 1440) % 1440;
    let best = null;
    let bestDist = NEAR;
    for (const item of timed) {
      const d = minutes < item.start ? item.start - minutes : minutes > item.drawEnd ? minutes - item.drawEnd : 0;
      if (d <= bestDist) {
        best = item;
        bestDist = d;
      }
    }
    return best;
  };

  const onArcKey = (e, index) => {
    const move = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key];
    let target = null;
    if (move) target = timed[(index + move + timed.length) % timed.length];
    else if (e.key === 'Home') target = timed[0];
    else if (e.key === 'End') target = timed[timed.length - 1];
    if (target) {
      e.preventDefault();
      arcRefs.current[target.task.id]?.focus();
      return;
    }
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      const item = timed[index];
      choose(selectedId === item.task.id ? null : item, { fromKeyboard: true });
    } else if (e.key === 'Escape') {
      clear(false);
    }
  };

  return (
    <div ref={wrapRef} className="mx-auto w-[min(74vw,272px)]">
      <div className="relative aspect-square">
        <svg ref={svgRef} viewBox={`0 0 ${SIZE} ${SIZE}`} className="w-full h-full" role="group" aria-label={summary}>
          {/* Pista del día */}
          <circle cx={cx} cy={cx} r={outer} fill="none" className="stroke-slate-800" strokeWidth={stroke} />
          <circle cx={cx} cy={cx} r={inner} fill="none" className="stroke-slate-800/50" strokeWidth={stroke - 4} />

          {/* Zona táctil de todo el anillo (debajo de los arcos): elige la tarea más cercana */}
          {timed.length > 0 && (
            <circle
              cx={cx} cy={cx} r={(outer + inner) / 2} fill="none" stroke="transparent" strokeWidth={outer - inner + HIT}
              pointerEvents="stroke" aria-hidden="true"
              onClick={(e) => { const item = nearest(e); if (item) tap(item); else clear(false); }}
            />
          )}

          {/* Horas: marca cada hora y número cada 6, fuera del anillo */}
          <g aria-hidden="true" pointerEvents="none">
            {Array.from({ length: 24 }, (_, h) => {
              const major = h % 6 === 0;
              const [x1, y1] = polar(cx, h * 60, outer + stroke / 2 + 3);
              const [x2, y2] = polar(cx, h * 60, outer + stroke / 2 + (major ? 9 : 6));
              return <line key={h} x1={x1} y1={y1} x2={x2} y2={y2} className={major ? 'stroke-slate-400' : 'stroke-slate-600'} strokeWidth={major ? 2 : 1} strokeLinecap="round" />;
            })}
            {[0, 6, 12, 18].map((h) => {
              const [x, y] = polar(cx, h * 60, outer + stroke / 2 + 20);
              return (
                <text key={h} x={x} y={y} textAnchor="middle" dominantBaseline="central" className="fill-slate-400 num" fontSize="13">
                  {String(h).padStart(2, '0')}
                </text>
              );
            })}
          </g>

          {/* Lo que va del día: por fuera del carril interior, para no cruzar el texto del centro */}
          {nowMinutes != null && nowMinutes > 0 && (
            <path d={arcPath(cx, 0, Math.max(nowMinutes, 1), outer + stroke / 2 + 1)} fill="none" className="stroke-amber-400/50" strokeWidth={2} strokeLinecap="round" aria-hidden="true" pointerEvents="none" />
          )}

          {/* Tareas: arco visible + zona táctil invisible y enfocable */}
          {timed.map((item, index) => {
            const radius = item.lane ? inner : outer;
            const start = item.start + GAP / 2;
            const end = Math.max(item.drawEnd - GAP / 2, start + 4);
            const d = arcPath(cx, start, end, radius);
            const isActive = item.task.id === hoverId || item.task.id === selectedId;
            const base = item.lane ? stroke - 4 : stroke;
            const tone = item.task.completed ? 'stroke-emerald-400' : item.missed ? 'stroke-indigo-400/70' : 'stroke-indigo-400';
            const width = (item.task.completed ? base - 5 : base) + (isActive ? 4 : 0);
            const state = item.task.completed ? ', hecha' : item.missed ? ', ya pasó la hora' : '';
            return (
              <g key={item.task.id}>
                {focusId === item.task.id && (
                  <path d={d} fill="none" className="stroke-amber-400" strokeWidth={width + 6} strokeLinecap="butt" aria-hidden="true" pointerEvents="none" />
                )}
                <path
                  d={d} fill="none" className={`${tone} transition-[stroke-width]`} strokeWidth={width} strokeLinecap="butt"
                  strokeDasharray={item.missed ? '4 3' : undefined} pointerEvents="none" aria-hidden="true"
                />
                <path
                  d={d}
                  fill="none"
                  stroke="transparent"
                  strokeWidth={HIT}
                  pointerEvents="stroke"
                  className="cursor-pointer outline-none"
                  ref={(el) => { arcRefs.current[item.task.id] = el; }}
                  tabIndex={item.task.id === tabStop ? 0 : -1}
                  role="button"
                  aria-pressed={item.task.id === selectedId}
                  aria-label={`${item.task.title}, ${formatTimeRange(item.task)}${state}`}
                  onClick={() => tap(item)}
                  onKeyDown={(e) => onArcKey(e, index)}
                  onMouseEnter={() => setHoverId(item.task.id)}
                  onMouseLeave={() => setHoverId(null)}
                  // Contorno solo con teclado (:focus-visible), no al tocar o hacer clic.
                  onFocus={(e) => {
                    setActiveId(item.task.id);
                    setFocusId(e.currentTarget.matches(':focus-visible') ? item.task.id : null);
                  }}
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

        {/* Centro: la tarea señalada o elegida; si no hay, cuántas faltan */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="text-center" style={{ maxWidth: `${((inner * 1.6) / SIZE) * 100}%` }}>
            {shown ? (
              <>
                <p className={`text-xs font-semibold ${shown.missed ? 'text-rose-400' : 'text-amber-400'}`}>{centerLabel}</p>
                <p className="num text-lg font-semibold text-slate-50 leading-tight mt-0.5">{formatTimeRange(shown.task)}</p>
                <p className="text-sm text-slate-200 leading-snug mt-1 line-clamp-2 break-words">{shown.task.title}</p>
                {(position || when) && <p className="text-xs text-slate-400 mt-1">{position || when}</p>}
                {selected && shown === selected && onToggleTask && (
                  <button
                    type="button"
                    ref={buttonRef}
                    onClick={() => onToggleTask(selected.task.id)}
                    onKeyDown={(e) => { if (e.key === 'Escape') clear(true); }}
                    aria-label={`${selected.task.completed ? 'Desmarcar' : 'Marcar como hecha'}: ${selected.task.title}`}
                    className="pointer-events-auto mt-2 inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-semibold px-4 min-h-11 rounded-full bg-indigo-600 text-white hover:bg-indigo-500 active:scale-[0.97] transition-transform"
                  >
                    {selected.task.completed
                      ? <><Undo2 className="w-4 h-4" aria-hidden="true" /> Desmarcar</>
                      : <><Check className="w-4 h-4" aria-hidden="true" /> Hecha</>}
                  </button>
                )}
              </>
            ) : (
              <>
                <p className={`text-xs font-semibold ${!upcoming && missed ? 'text-rose-400' : 'text-amber-400'}`}>
                  {!timed.length ? 'Día libre' : upcoming ? 'Hoy' : missed ? 'Se pasó la hora' : 'Todo hecho'}
                </p>
                <p className="text-sm text-slate-300 leading-snug mt-1">
                  {!timed.length
                    ? 'Agenda algo con hora para verlo aquí'
                    : upcoming
                      ? `${plural(upcoming, 'tarea con hora', 'tareas con hora')} por hacer`
                      : missed
                        ? `${plural(missed, 'tarea', 'tareas')} sin marcar`
                        : 'No quedan tareas con hora hoy'}
                </p>
                {upcoming > 0 && missed > 0 && <p className="text-xs text-rose-400 mt-1">{missed} ya {missed === 1 ? 'pasó' : 'pasaron'}</p>}
                {unchecked > 0 && <p className="text-xs text-slate-400 mt-1.5">Elige un arco para ver la tarea</p>}
                {untimed > 0 && <p className="text-xs text-slate-400 mt-1.5">+{untimed} sin hora</p>}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Cómo leer el reloj: la carátula de 24 h es propia de LifeOS, así que se explica */}
      {timed.length > 0 && (
        <details className="group mt-2 text-sm text-slate-300">
          <summary className="mx-auto w-fit flex items-center gap-1.5 min-h-11 px-3 rounded-full cursor-pointer text-slate-400 hover:text-slate-200 list-none [&::-webkit-details-marker]:hidden">
            <HelpCircle className="w-4 h-4" aria-hidden="true" /> Cómo leer el reloj
          </summary>
          <div className="mt-1 rounded-xl bg-slate-800/60 px-4 py-3 space-y-2">
            <p>El círculo es el día completo: medianoche arriba, mediodía abajo. La manecilla marca la hora actual.</p>
            <ul className="space-y-1.5" aria-label="Qué significa cada arco">
              <li className="flex items-center gap-3">
                <svg width="28" height="8" aria-hidden="true"><line x1="0" y1="4" x2="28" y2="4" className="stroke-indigo-400" strokeWidth="8" /></svg>
                Por hacer
              </li>
              <li className="flex items-center gap-3">
                <svg width="28" height="8" aria-hidden="true"><line x1="0" y1="4" x2="28" y2="4" className="stroke-emerald-400" strokeWidth="4" /></svg>
                Hecha (delgado)
              </li>
              <li className="flex items-center gap-3">
                <svg width="28" height="8" aria-hidden="true"><line x1="0" y1="4" x2="28" y2="4" className="stroke-indigo-400/70" strokeWidth="8" strokeDasharray="4 3" /></svg>
                Ya pasó su hora sin marcar (punteado)
              </li>
            </ul>
            <p>Si dos tareas se enciman, una va por dentro. Toca varias veces para pasar de una a otra.</p>
          </div>
        </details>
      )}

      {/* Anuncia la selección a los lectores de pantalla (también al tocar) */}
      <p className="sr-only" aria-live="polite">{announce}</p>
    </div>
  );
}
