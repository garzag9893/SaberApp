import { Wallet, CheckCircle2, Circle, Repeat, ArrowRight } from 'lucide-react';
import { formatReadableDate, formatLongDate, getTodayKey } from '../lib/dates.js';
import { todayTasks, isOverdue, formatTimeRange } from '../lib/agenda.js';
import { monthOf, filterByMonth, summarize, budgetStatus } from '../lib/finance.js';
import { categoryColor } from '../lib/categories.js';
import { useNowMinutes } from '../hooks/useNow.js';
import DayDial from '../components/DayDial.jsx';
import { EmptyCalendar } from '../components/Illustrations.jsx';
import { ui, money } from '../components/ui.jsx';

function Stat({ label, value, total, onClick, tone = 'bg-indigo-400' }) {
  const pct = total ? Math.min((value / total) * 100, 100) : 0;
  return (
    <button type="button" onClick={onClick} className="text-left group">
      <dt className="text-[11px] uppercase tracking-[0.14em] text-slate-500 group-hover:text-slate-300">{label}</dt>
      <dd className="num text-2xl font-semibold text-slate-50 mt-1">
        {value}<span className="text-slate-500 text-base">/{total}</span>
      </dd>
      <div className="h-1 mt-2 rounded-full bg-slate-800 overflow-hidden" aria-hidden="true">
        <div className={`h-full rounded-full ${tone}`} style={{ width: `${pct}%` }} />
      </div>
    </button>
  );
}

// Saludo según la hora real del dispositivo.
const greeting = (hour) => (hour < 12 ? 'Buenos días' : hour < 19 ? 'Buenas tardes' : 'Buenas noches');

export default function DashboardView({ data, todayKey, name = '', onNavigate, onToggleTask }) {
  const { tasks, transactions, health, budgets, settings } = data;
  const nowMinutes = useNowMinutes();
  // La manecilla del ahora solo tiene sentido si el día mostrado es el real (no una simulación).
  const isRealToday = todayKey === getTodayKey();

  const today = todayTasks(tasks, todayKey);
  const doneToday = today.filter((t) => t.completed).length;
  const overdueCount = tasks.filter((t) => isOverdue(t, todayKey)).length;
  const completedHabits = health.habits.filter((h) => h.done).length;
  const dialTasks = tasks.filter((t) => (t.date || todayKey) === todayKey);

  const all = summarize(transactions);
  const month = summarize(filterByMonth(transactions, monthOf(todayKey)));
  const overBudget = settings.expenseCategories
    .map((c) => c.name)
    .filter((name) => budgetStatus(month.byCategory[name] || 0, budgets[name])?.level === 'over');
  const recentTx = [...transactions].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
  const { weekday, dayMonth } = formatLongDate(todayKey);

  const insight = (() => {
    if (health.sleepHours != null && health.sleepHours < 6.5) return 'Dormiste menos de 6.5 h. Prioriza tus 2 tareas más importantes y evita compras impulsivas.';
    if (overBudget.length) return `Ya superaste tu presupuesto de ${overBudget.join(', ')} este mes. Revisa tus gastos antes de seguir comprando.`;
    if (all.balance < 1000) return 'Tu balance está ajustado. Mantén los gastos variables al mínimo esta semana.';
    if (completedHabits >= 3) return 'Buena racha de hábitos hoy. Es buen momento para avanzar en lo importante.';
    const pending = today.length - doneToday;
    const late = overdueCount ? `, ${overdueCount} ${overdueCount === 1 ? 'atrasada' : 'atrasadas'}` : '';
    const missing = health.sleepHours == null || health.mood == null ? ' Registra cómo dormiste y tu energía.' : '';
    return `${pending ? `Te ${pending === 1 ? 'queda 1 tarea' : `quedan ${pending} tareas`} hoy${late}.` : 'No te quedan tareas hoy.'}${missing}`;
  })();

  return (
    <div className="space-y-6">
      {/* El día como reloj */}
      <section className={`${ui.card} p-6 md:p-8 grid gap-8 md:grid-cols-[auto_1fr] items-center`}>
        <DayDial tasks={dialTasks} nowMinutes={isRealToday ? nowMinutes : null} />
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-[0.2em] font-semibold text-amber-400">{weekday}</p>
          <h2 className="font-display text-4xl md:text-5xl font-bold text-slate-50 leading-[1.02] mt-1">{dayMonth}</h2>
          <p className="text-slate-300 mt-4 max-w-prose">
            <span className="text-slate-50 font-medium">{greeting(Math.floor(nowMinutes / 60))}{name ? `, ${name}` : ''}.</span>{' '}
            {insight}
          </p>
          <dl className="grid grid-cols-3 gap-4 sm:gap-6 mt-7 max-w-md">
            <Stat label="Tareas" value={doneToday} total={today.length} onClick={() => onNavigate('agenda')} />
            <Stat label="Hábitos" value={completedHabits} total={health.habits.length} onClick={() => onNavigate('health')} tone="bg-emerald-400" />
            <Stat label="Agua" value={health.water} total={health.waterGoal} onClick={() => onNavigate('health')} tone="bg-sky-400" />
          </dl>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <section className={`${ui.card} p-5 lg:col-span-3`}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-base text-slate-100">Hoy, en orden</h3>
            <button onClick={() => onNavigate('agenda')} className={ui.link}>Abrir agenda <ArrowRight className="w-3.5 h-3.5" /></button>
          </div>
          {today.length === 0 ? (
            <div className="flex flex-col items-center text-center py-4">
              <EmptyCalendar className="w-32 h-24" />
              <p className="text-sm text-slate-300 mt-2">Nada agendado para hoy.</p>
              <p className="text-xs text-slate-500 mt-1">Escribe arriba, por ejemplo "Gym 7pm" o "Llamar a mamá mañana".</p>
            </div>
          ) : (
            <ol className="space-y-1">
              {today.slice(0, 7).map((task) => (
                <li key={task.id}>
                  <button
                    type="button" onClick={() => onToggleTask(task.id)} aria-pressed={task.completed}
                    className="w-full text-left grid grid-cols-[5.75rem_1.25rem_1fr] items-center gap-3 px-2 py-2.5 rounded-xl hover:bg-slate-800/60"
                  >
                    {isOverdue(task, todayKey)
                      ? <span className="text-[11px] font-semibold text-rose-400">Atrasada</span>
                      : <span className="num text-xs text-slate-400">{formatTimeRange(task) === 'Sin hora' ? '—' : formatTimeRange(task)}</span>}
                    {task.completed ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <Circle className="w-5 h-5 text-slate-600" />}
                    <span className={`text-sm min-w-0 break-words ${task.completed ? 'line-through text-slate-500' : 'text-slate-100'}`}>
                      {task.title}
                      {task.repeat !== 'none' && <Repeat className="inline w-3 h-3 ml-1.5 text-sky-400" aria-label="Se repite" />}
                    </span>
                  </button>
                </li>
              ))}
            </ol>
          )}
          {today.length > 7 && <p className="text-xs text-slate-500 mt-2 px-2">y {today.length - 7} más en la agenda</p>}
        </section>

        <section className={`${ui.card} p-5 lg:col-span-2 flex flex-col`}>
          <button type="button" onClick={() => onNavigate('finances')} className="text-left group">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-base text-slate-100">Dinero</h3>
              <Wallet className="w-4 h-4 text-slate-500 group-hover:text-indigo-400" />
            </div>
            <p className="text-[11px] uppercase tracking-[0.14em] text-slate-500 mt-3">Balance disponible</p>
            <p className={`num text-3xl font-semibold mt-1 ${all.balance < 0 ? 'text-rose-400' : 'text-slate-50'}`}>
              {all.balance < 0 ? '-' : ''}${money(Math.abs(all.balance))}
            </p>
            <p className="text-xs text-slate-400 mt-1">Gastos de este mes <span className="num text-slate-200">${money(month.expense)}</span></p>
            {overBudget.length > 0 && <p className="text-xs text-rose-400 mt-1">Presupuesto excedido: {overBudget.join(', ')}</p>}
          </button>
          <div className="border-t border-slate-800 mt-4 pt-3 space-y-1 flex-1">
            {recentTx.length === 0 ? (
              <p className="text-xs text-slate-500 py-4 text-center">Aún no hay movimientos.</p>
            ) : recentTx.map((tr) => (
              <div key={tr.id} className="flex items-center justify-between gap-3 py-1.5">
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: categoryColor(settings, tr.type, tr.category) }} />
                  <div className="min-w-0">
                    <p className="text-sm text-slate-200 truncate">{tr.desc}</p>
                    <p className="text-[11px] text-slate-500">{tr.category} · {formatReadableDate(tr.date)}</p>
                  </div>
                </div>
                <span className={`num text-sm shrink-0 ${tr.type === 'income' ? 'text-emerald-400' : 'text-slate-300'}`}>
                  {tr.type === 'income' ? '+' : '−'}${money(tr.amount)}
                </span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
