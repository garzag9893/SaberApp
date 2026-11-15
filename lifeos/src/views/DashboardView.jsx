import { useState } from 'react';
import { Wallet, CheckCircle2, Circle, Repeat, ArrowRight, Plus, PartyPopper, ChevronDown } from 'lucide-react';
import { formatReadableDate, formatLongDate, getTodayKey, isTime, timeToMinutes, sortTasksChronologically } from '../lib/dates.js';
import { isOverdue, formatTimeRange } from '../lib/agenda.js';
import { monthOf, filterByMonth, summarize, budgetStatus, formatMonth } from '../lib/finance.js';
import { categoryColor } from '../lib/categories.js';
import { useNowMinutes } from '../hooks/useNow.js';
import DayDial from '../components/DayDial.jsx';
import { EmptyCalendar } from '../components/Illustrations.jsx';
import { ui, money } from '../components/ui.jsx';

// Saludo según la hora real del dispositivo.
const greeting = (hour) => (hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches');

const inTime = (mins) => {
  if (mins < 60) return `en ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `en ${h} h ${m} min` : `en ${h} h`;
};


// Lo que la persona necesita saber primero al abrir: qué está pasando o qué sigue.
function headline(today, nowMinutes) {
  const pending = today.filter((t) => !t.completed);
  const timed = pending
    .filter((t) => isTime(t.time))
    .map((t) => {
      const start = timeToMinutes(t.time);
      const end = isTime(t.endTime) && timeToMinutes(t.endTime) > start ? timeToMinutes(t.endTime) : start;
      return { t, start, end };
    })
    .sort((a, b) => a.start - b.start);

  if (nowMinutes != null) {
    const current = timed.find((i) => i.start <= nowMinutes && nowMinutes < i.end);
    if (current) return { title: current.t.title, time: 'Ahora', detail: `termina a las ${current.t.endTime}` };
    const next = timed.find((i) => i.start > nowMinutes);
    if (next) return { title: next.t.title, time: formatTimeRange(next.t), detail: inTime(next.start - nowMinutes) };
  } else if (timed.length) {
    return { title: timed[0].t.title, time: formatTimeRange(timed[0].t) };
  }
  if (pending.length) {
    return {
      title: pending.length === 1 ? pending[0].title : `${pending.length} pendientes para hoy`,
      detail: pending.length === 1 ? 'Sin hora fija' : `Empieza por: ${pending[0].title}`,
    };
  }
  if (today.length) return { title: 'Día completo', detail: `Terminaste ${today.length === 1 ? 'la tarea' : `las ${today.length} tareas`} de hoy.`, done: true };
  return { title: 'Día libre', detail: 'Escribe arriba lo que quieras agendar.' };
}

const actionClass = 'text-sm font-medium text-right text-indigo-400 hover:text-indigo-300 min-h-11 px-2 -mr-2';
const rowClass = 'grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-4';

function Notice({ children, action, actionLabel, onAction, tone = 'text-slate-300' }) {
  return (
    <li className={`${rowClass} py-1 border-t border-slate-800 first:border-t-0`}>
      <span className={`text-sm py-2 ${tone}`}>{children}</span>
      {action && (
        <button type="button" onClick={onAction} aria-label={actionLabel} className={actionClass}>
          {action}
        </button>
      )}
    </li>
  );
}

// Lo atrasado vive en un solo lugar: una fila que se abre, de la más antigua a la más reciente.
function OverdueNotice({ tasks, onMove }) {
  const [open, setOpen] = useState(false);
  if (tasks.length === 1) {
    const [t] = tasks;
    return (
      <Notice action="Mover a hoy" actionLabel={`Mover a hoy: ${t.title}`} onAction={() => onMove([t.id])}>
        <span className="text-rose-400 font-medium">Atrasada</span> desde el {formatReadableDate(t.date).toLowerCase()}: {t.title}
      </Notice>
    );
  }
  return (
    <li className="py-1 border-t border-slate-800 first:border-t-0">
      <div className={rowClass}>
        <button
          type="button" aria-expanded={open} aria-controls="atrasadas" onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-2 text-left text-sm text-slate-300 hover:text-slate-100 min-h-11"
        >
          <ChevronDown className={`w-4 h-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
          <span>
            <span className="text-rose-400 font-medium">{tasks.length} atrasadas</span>, desde el {formatReadableDate(tasks[0].date).toLowerCase()}
          </span>
        </button>
        <button type="button" onClick={() => onMove(tasks.map((t) => t.id))} className={actionClass}>
          Mover todas a hoy
        </button>
      </div>
      {open && (
        <ul id="atrasadas" className="pl-6 pb-1">
          {tasks.map((t) => (
            <li key={t.id} className={rowClass}>
              <span className="text-sm text-slate-300 py-2 min-w-0 break-words">
                <span className="text-slate-400">{formatReadableDate(t.date)}</span> · {t.title}
              </span>
              <button type="button" onClick={() => onMove([t.id])} aria-label={`Mover a hoy: ${t.title}`} className={actionClass}>
                Mover a hoy
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}

export default function DashboardView({ data, todayKey, name = '', onNavigate, onToggleTask, onMoveToToday, onAddWater }) {
  const { tasks, transactions, health, budgets, settings } = data;
  const nowMinutes = useNowMinutes();
  // El "ahora" solo tiene sentido si el día mostrado es el real (no una simulación).
  const isRealToday = todayKey === getTodayKey();
  const now = isRealToday ? nowMinutes : null;

  const [noticesOpen, setNoticesOpen] = useState(false);

  // Solo lo de hoy; lo atrasado va aparte, en su propio aviso.
  const dialTasks = tasks.filter((t) => (t.date || todayKey) === todayKey);
  const today = sortTasksChronologically(dialTasks, todayKey);
  const doneToday = today.filter((t) => t.completed).length;
  const overdue = tasks.filter((t) => isOverdue(t, todayKey)).sort((a, b) => a.date.localeCompare(b.date));
  const completedHabits = health.habits.filter((h) => h.done).length;

  const currentMonth = monthOf(todayKey);
  const month = summarize(filterByMonth(transactions, currentMonth));
  const hasMoney = transactions.length > 0;
  const overBudget = settings.expenseCategories
    .map((c) => ({ name: c.name, status: budgetStatus(month.byCategory[c.name] || 0, budgets[c.name]) }))
    .filter((c) => c.status?.level === 'over')
    .sort((a, b) => a.status.remaining - b.status.remaining); // el más excedido primero
  // Si el mes va en negativo: lo que más pesa, para saber por dónde empezar.
  const topExpense = Object.entries(month.byCategory).sort((a, b) => b[1] - a[1])[0];
  const recentTx = [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
  const { weekday, dayMonth } = formatLongDate(todayKey);
  const head = headline(today, now);

  // Avisos en orden de urgencia: lo atrasado, luego el dinero, luego el registro del día.
  // `topics` resume los avisos en una línea cuando van plegados en el celular.
  const notices = [];
  const topics = [];
  if (overdue.length) {
    notices.push(<OverdueNotice key="overdue" tasks={overdue} onMove={onMoveToToday} />);
    topics.push(overdue.length === 1 ? '1 atrasada' : `${overdue.length} atrasadas`);
  }
  if (hasMoney) {
    overBudget.slice(0, 1).forEach(({ name: cat, status }) => notices.push(
      <Notice key={`b-${cat}`} action="Ver presupuesto" onAction={() => onNavigate('finances')}>
        <span className="text-rose-400 font-medium">{cat}: te pasaste por <span className="num">${money(-status.remaining)}</span></span>
        {' '}· límite <span className="num">${money(status.limit)}</span> al mes
        {overBudget.length > 1 && ` · y ${overBudget.length - 1} ${overBudget.length === 2 ? 'presupuesto más' : 'presupuestos más'}`}
      </Notice>,
    ));
    if (overBudget.length) topics.push('presupuesto');
  }
  if (health.sleepHours == null || health.mood == null) {
    notices.push(
      <Notice key="health" action="Registrar" onAction={() => onNavigate('health')}>
        ¿Cómo dormiste y cómo va tu energía?
      </Notice>,
    );
    topics.push('sueño y energía');
  }
  // En celular, dos o más avisos se juntan en una fila que se abre; en pantallas grandes se ven todos.
  const foldNotices = notices.length > 1;

  return (
    <div className="space-y-6">
      {/* El día como reloj: primero lo que sigue */}
      <section className={`${ui.card} p-6 md:p-8 grid gap-8 lg:grid-cols-[auto_minmax(0,1fr)] items-center`} aria-labelledby="hoy-sigue">
        {/* En celular y tablet, primero la respuesta (qué sigue) y después el reloj */}
        <div className="order-2 lg:order-1">
          <DayDial tasks={dialTasks} nowMinutes={now} onToggleTask={onToggleTask} />
        </div>
        <div className="min-w-0 order-1 lg:order-2">
          <h2 id="hoy-sigue" title={head.title} className="font-display text-[clamp(1.875rem,5vw,2.875rem)] font-bold text-slate-50 leading-[1.05] break-words text-balance line-clamp-3">
            {head.done && <PartyPopper className="inline w-[0.8em] h-[0.8em] mr-2 -mt-1 text-amber-400" aria-hidden="true" />}
            {head.title}
          </h2>
          <p className="text-base text-indigo-300 mt-2">
            {head.time && <span className="num font-medium">{head.time}</span>}
            {head.time && head.detail && ' · '}
            {head.detail}
          </p>
          <p className="text-slate-300 mt-4 max-w-prose">
            {greeting(Math.floor(nowMinutes / 60))}{name ? `, ${name}` : ''}. Hoy es {weekday} {dayMonth}.
          </p>

          {foldNotices && (
            <button
              type="button" aria-expanded={noticesOpen} aria-controls="avisos" onClick={() => setNoticesOpen((o) => !o)}
              className="md:hidden mt-5 w-full flex items-center justify-between gap-3 text-left px-4 min-h-14 rounded-xl bg-slate-800/70 hover:bg-slate-800"
            >
              <span className="min-w-0">
                <span className="block text-sm font-medium text-slate-100">{notices.length} cosas por atender</span>
                <span className="block text-xs text-slate-400">{topics.join(' · ')}</span>
              </span>
              <ChevronDown className={`w-5 h-5 shrink-0 text-slate-400 transition-transform ${noticesOpen ? 'rotate-180' : ''}`} aria-hidden="true" />
            </button>
          )}
          {notices.length > 0 && (
            <ul id="avisos" aria-label="Avisos" className={`mt-5 max-w-xl ${foldNotices && !noticesOpen ? 'hidden md:block' : ''} ${foldNotices ? 'max-md:mt-2' : ''}`}>
              {notices}
            </ul>
          )}

          <ul className="flex flex-wrap items-center gap-2 mt-6" aria-label="Avance de hoy">
            <li>
              <button type="button" onClick={() => onNavigate('agenda')} className="text-sm px-4 min-h-11 rounded-full bg-slate-800 text-slate-200 hover:bg-slate-700">
                {today.length ? `${doneToday} de ${today.length} ${today.length === 1 ? 'tarea' : 'tareas'}` : 'Sin tareas hoy'}
              </button>
            </li>
            <li>
              <button type="button" onClick={() => onNavigate('health')} className="text-sm px-4 min-h-11 rounded-full bg-slate-800 text-slate-200 hover:bg-slate-700">
                {health.habits.length ? `${completedHabits} de ${health.habits.length} hábitos` : 'Sin hábitos aún'}
              </button>
            </li>
            <li className="flex items-center rounded-full bg-slate-800">
              <span className="text-sm pl-4 pr-2 text-slate-200">{health.water} de {health.waterGoal} vasos</span>
              <button
                type="button" onClick={onAddWater} aria-label="Sumar un vaso de agua"
                className="flex items-center gap-1 text-sm font-medium text-sky-300 hover:text-sky-200 pl-3 pr-4 min-h-11 border-l border-slate-700 rounded-r-full"
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" /> 1
              </button>
            </li>
          </ul>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <section className={`${ui.card} p-5 lg:col-span-3`} aria-labelledby="hoy-orden">
          <div className="flex justify-between items-center mb-3">
            <h3 id="hoy-orden" className="font-semibold text-base text-slate-100">Hoy, en orden</h3>
            <button onClick={() => onNavigate('agenda')} className={`${ui.link} text-sm min-h-11 -my-3`}>
              Abrir agenda <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
          {today.length === 0 ? (
            <div className="flex flex-col items-center text-center py-4">
              <EmptyCalendar className="w-32 h-24" />
              <p className="text-sm text-slate-300 mt-2">Nada agendado para hoy.</p>
              <p className="text-sm text-slate-400 mt-1">Escribe arriba, por ejemplo "Gym 7pm" o "Llamar a mamá mañana".</p>
            </div>
          ) : (
            <ol className="space-y-1">
              {today.slice(0, 7).map((task) => {
                const range = formatTimeRange(task);
                return (
                  <li key={task.id}>
                    <button
                      type="button" role="checkbox" aria-checked={task.completed} onClick={() => onToggleTask(task.id)}
                      className="w-full text-left grid grid-cols-[5.75rem_1.25rem_minmax(0,1fr)] items-center gap-3 px-2 py-3 rounded-xl hover:bg-slate-800/60"
                    >
                      <span className={`text-xs text-slate-400 ${isTime(task.time) ? 'num' : ''}`}>{range}</span>
                      {task.completed ? <CheckCircle2 className="w-5 h-5 text-emerald-400" aria-hidden="true" /> : <Circle className="w-5 h-5 text-slate-500" aria-hidden="true" />}
                      <span className={`text-sm min-w-0 break-words ${task.completed ? 'line-through text-slate-400' : 'text-slate-100'}`}>
                        {task.title}
                        {task.repeat !== 'none' && <Repeat className="inline w-3 h-3 ml-1.5 text-sky-400" aria-hidden="true" />}
                        {task.repeat !== 'none' && <span className="sr-only">, se repite</span>}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ol>
          )}
          {today.length > 7 && (
            <button onClick={() => onNavigate('agenda')} className={`${ui.link} text-sm mt-2 px-2 py-2`}>
              Ver {today.length - 7} más en la agenda <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          )}
        </section>

        <section className={`${ui.card} p-5 lg:col-span-2 flex flex-col`} aria-labelledby="hoy-dinero">
          <div className="flex items-center justify-between">
            <h3 id="hoy-dinero" className="font-semibold text-base text-slate-100">Dinero en {formatMonth(currentMonth).split(' ')[0].toLowerCase()}</h3>
            <button type="button" onClick={() => onNavigate('finances')} className={`${ui.link} text-sm min-h-11 -my-3`}>
              Finanzas <ArrowRight className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </div>
          {hasMoney ? (
            <>
              <dl className="mt-3 space-y-1">
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-sm text-slate-400">Ingresos</dt>
                  <dd className={`num text-sm ${month.income ? 'text-emerald-400' : 'text-slate-400'}`}>{month.income ? '+' : ''}${money(month.income)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <dt className="text-sm text-slate-400">Gastos</dt>
                  <dd className="num text-sm text-slate-200">{month.expense ? '−' : ''}${money(month.expense)}</dd>
                </div>
                <div className="flex items-baseline justify-between gap-4 pt-2 mt-1 border-t border-slate-800">
                  {/* En negativo, la etiqueta dice lo que pasó; la cifra va sin signo para no leerse "te queda menos algo". */}
                  <dt className="text-sm text-slate-100 font-medium">{month.balance < 0 ? 'Gastaste de más' : 'Te queda'}</dt>
                  <dd className={`num text-xl font-semibold ${month.balance < 0 ? 'text-rose-400' : 'text-slate-50'}`}>${money(Math.abs(month.balance))}</dd>
                </div>
              </dl>
              {month.balance < 0 && (
                <p className="text-sm text-slate-300 mt-2">
                  {month.income === 0
                    ? <>Aún no registras ingresos este mes. Si ya cobraste, escríbelo arriba, por ejemplo "Nómina $15,000".</>
                    : <>Salió <span className="num">${money(-month.balance)}</span> más de lo que entró. Lo que más pesa: {topExpense[0]}, con <span className="num">${money(topExpense[1])}</span>.</>}
                </p>
              )}
              <ul className="border-t border-slate-800 mt-4 pt-2 flex-1" aria-label="Últimos movimientos">
                {recentTx.map((tr) => (
                  <li key={tr.id} className="flex items-center justify-between gap-3 py-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: categoryColor(settings, tr.type, tr.category) }} aria-hidden="true" />
                      <div className="min-w-0">
                        <p className="text-sm text-slate-200 truncate">{tr.desc}</p>
                        <p className="text-xs text-slate-400">{tr.category} · {formatReadableDate(tr.date)}</p>
                      </div>
                    </div>
                    <span className={`num text-sm shrink-0 ${tr.type === 'income' ? 'text-emerald-400' : 'text-slate-300'}`}>
                      {tr.type === 'income' ? '+' : '−'}${money(tr.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <div className="flex items-center gap-3 mt-3 text-sm text-slate-400">
              <Wallet className="w-5 h-5 text-slate-500 shrink-0" aria-hidden="true" />
              <p>Aún no registras movimientos. Escribe arriba, por ejemplo "Comida $180".</p>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
