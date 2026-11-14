import { useState } from 'react';
import {
  BarChart3, Droplets, Moon, Activity, History, CheckCircle2, Circle, Pencil, Check, Trash2, Plus, Flame,
} from 'lucide-react';
import { formatReadableDate, getShortDayName } from '../lib/dates.js';
import { habitStreak, nextHabitId, habitCalendar } from '../lib/habits.js';
import { HabitHeatmap } from '../components/TrendCharts.jsx';
import { ui } from '../components/ui.jsx';
import { SleepChart, EnergyChart } from '../components/MiniCharts.jsx';

const MAX_WATER = 15;

function WeeklyCharts({ health }) {
  const recent = [...(health.dailyLogs || [])].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 6).reverse()
    .map((log) => ({ key: log.date, day: getShortDayName(log.date), sleep: log.sleep ?? null, mood: log.mood ?? null, isToday: false }));
  const days = [...recent, { key: 'hoy', day: 'Hoy', sleep: health.sleepHours, mood: health.mood, isToday: true }];
  return (
    <div className={`${ui.card} p-6`}>
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-1 mb-5">
        <h3 className="font-semibold text-base flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-indigo-400" /> Últimos {days.length} días
        </h3>
        <p className="text-xs text-slate-500">Cada día se archiva a medianoche.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <div>
          <p className="text-sm font-medium text-slate-200 mb-2 flex items-center gap-2"><Moon className="w-4 h-4 text-indigo-400" /> Sueño</p>
          <SleepChart days={days} />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-200 mb-2 flex items-center gap-2"><Activity className="w-4 h-4 text-amber-400" /> Energía</p>
          <EnergyChart days={days} />
        </div>
      </div>
    </div>
  );
}

export default function HealthView({ health, updateHealth, showToast }) {
  const [editingHabits, setEditingHabits] = useState(false);
  const [newHabit, setNewHabit] = useState('');
  const completed = health.habits.filter((h) => h.done).length;

  const setHabits = (fn) => updateHealth((prev) => ({ ...prev, habits: fn(prev.habits) }));

  const deleteHabit = (id) => {
    const index = health.habits.findIndex((h) => h.id === id);
    if (index < 0) return;
    const removed = health.habits[index];
    setHabits((list) => list.filter((h) => h.id !== id));
    showToast(`🗑️ Hábito eliminado: ${removed.name || 'sin nombre'}`, {
      label: 'Deshacer',
      onClick: () => setHabits((list) => (list.some((h) => h.id === removed.id) ? list : [...list.slice(0, index), removed, ...list.slice(index)])),
    });
  };

  const finishEditing = () => {
    // Los hábitos que quedaron sin nombre se descartan.
    setHabits((list) => list.map((h) => ({ ...h, name: h.name.trim() })).filter((h) => h.name));
    setEditingHabits(false);
  };

  return (
    <div className="space-y-6">
      <WeeklyCharts health={health} />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className={`${ui.card} p-6 space-y-6`}>
          <div className="flex justify-between items-center">
            <h3 className="font-semibold text-base">Registro de Hoy</h3>
            <span className="text-xs text-slate-400">{formatReadableDate(health.lastActiveDate)}</span>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="flex items-center gap-2 text-sky-400"><Droplets className="w-4 h-4" /> Hidratación</span>
              <span className="flex items-center gap-1.5 num">
                {health.water} /
                <select
                  aria-label="Meta diaria de vasos de agua" title="Meta diaria" value={health.waterGoal}
                  onChange={(e) => {
                    const waterGoal = Number(e.target.value);
                    updateHealth((prev) => ({ ...prev, waterGoal }));
                  }}
                  className="bg-slate-800 border border-slate-700 rounded-md px-1 py-0.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                >
                  {Array.from({ length: MAX_WATER }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
                </select>
                vasos
              </span>
            </div>
            <div className="flex gap-2">
              <button onClick={() => updateHealth((prev) => ({ ...prev, water: Math.max(0, prev.water - 1) }))} disabled={health.water <= 0} aria-label="Quitar un vaso de agua" className="px-3 py-1.5 bg-slate-800 rounded-lg text-sm disabled:opacity-40">-1</button>
              <button onClick={() => updateHealth((prev) => ({ ...prev, water: Math.min(prev.water + 1, MAX_WATER) }))} disabled={health.water >= MAX_WATER} className="flex-1 py-1.5 bg-sky-600/20 text-sky-400 border border-sky-500/30 rounded-lg text-sm font-medium disabled:opacity-40">
                + Registrar Vaso de Agua
              </button>
            </div>
            <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
              <div className={`h-full transition-all ${health.water >= health.waterGoal ? 'bg-emerald-400' : 'bg-sky-500'}`} style={{ width: `${Math.min((health.water / health.waterGoal) * 100, 100)}%` }} />
            </div>
          </div>

          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="flex items-center gap-2 text-indigo-400"><Moon className="w-4 h-4" /> Horas de Sueño</span>
              <span className={health.sleepHours == null ? 'text-xs text-slate-500' : 'num font-semibold text-indigo-300'}>
                {health.sleepHours == null ? '¿Cuánto dormiste?' : `${health.sleepHours} hrs`}
              </span>
            </div>
            <input
              type="range" min="3" max="10" step="0.5" aria-label="Horas de sueño"
              value={health.sleepHours ?? 7}
              onChange={(e) => {
                const sleepHours = parseFloat(e.target.value);
                updateHealth((prev) => ({ ...prev, sleepHours }));
              }}
              className={`w-full accent-indigo-500 ${health.sleepHours == null ? 'opacity-40' : ''}`}
            />
          </div>

          <div>
            <span className="flex items-center justify-between text-sm text-amber-400 mb-2">
              <span className="flex items-center gap-2"><Activity className="w-4 h-4" /> Nivel de Energía / Ánimo</span>
              {health.mood == null && <span className="text-xs text-slate-500">Sin registrar</span>}
            </span>
            <div className="grid grid-cols-5 gap-2">
              {[1, 2, 3, 4, 5].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => updateHealth((prev) => ({ ...prev, mood: lvl }))}
                  aria-pressed={health.mood === lvl}
                  aria-label={`Energía ${lvl} de 5`}
                  className={`py-2 rounded-xl text-sm font-bold border transition-all ${health.mood === lvl ? 'bg-amber-500/20 border-amber-500 text-amber-300' : 'bg-slate-800/50 border-slate-800 text-slate-400'}`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className={`${ui.card} p-6`}>
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-base">Hábitos Diarios</h3>
            <div className="flex items-center gap-3">
              {!editingHabits && <span className="text-xs text-emerald-400 font-medium">{completed}/{health.habits.length} hoy</span>}
              <button onClick={() => (editingHabits ? finishEditing() : setEditingHabits(true))} className={ui.link}>
                {editingHabits ? <><Check className="w-3.5 h-3.5" /> Listo</> : <><Pencil className="w-3.5 h-3.5" /> Editar</>}
              </button>
            </div>
          </div>

          {editingHabits ? (
            <div className="space-y-2">
              {health.habits.map((habit, i) => (
                <div key={habit.id} className="flex items-center gap-2">
                  <input
                    type="text" aria-label={`Nombre del hábito ${i + 1}`} value={habit.name}
                    onChange={(e) => {
                      const name = e.target.value;
                      setHabits((list) => list.map((h) => (h.id === habit.id ? { ...h, name } : h)));
                    }}
                    className="flex-1 min-w-0 bg-slate-800/70 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                  />
                  <button onClick={() => deleteHabit(habit.id)} className="text-slate-400 hover:text-rose-400 p-2 rounded-lg hover:bg-slate-800" aria-label={`Eliminar hábito: ${habit.name}`} title="Eliminar hábito">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const name = newHabit.trim();
                  if (!name) return;
                  setHabits((list) => [...list, { id: nextHabitId(list), name, done: false }]);
                  setNewHabit('');
                }}
                className="flex items-center gap-2 pt-2"
              >
                <input
                  type="text" placeholder="Nuevo hábito (ej. Caminar 8,000 pasos)" aria-label="Nuevo hábito" value={newHabit}
                  onChange={(e) => setNewHabit(e.target.value)}
                  className="flex-1 min-w-0 bg-slate-800/70 border border-dashed border-slate-600 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                />
                <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-2 rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0">
                  <Plus className="w-3.5 h-3.5" /> Agregar
                </button>
              </form>
            </div>
          ) : health.habits.length === 0 ? (
            <p className="text-sm text-slate-500 py-6 text-center">No tienes hábitos. Pulsa Editar para agregar el primero.</p>
          ) : (
            <div className="space-y-3">
              {health.habits.map((habit) => {
                const streak = habitStreak(habit, health);
                return (
                  <button
                    type="button" key={habit.id} aria-pressed={habit.done}
                    onClick={() => setHabits((list) => list.map((h) => (h.id === habit.id ? { ...h, done: !h.done } : h)))}
                    className="w-full text-left flex items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-800/40 hover:bg-slate-800 cursor-pointer"
                  >
                    <span className={`text-sm min-w-0 break-words ${habit.done ? 'line-through text-slate-500' : 'text-slate-200'}`}>{habit.name}</span>
                    <span className="flex items-center gap-2 shrink-0">
                      {streak >= 2 && (
                        <span className="text-[11px] text-amber-300 flex items-center gap-0.5" title={`${streak} días seguidos`}>
                          <Flame className="w-3.5 h-3.5" /> {streak}
                        </span>
                      )}
                      {habit.done ? <CheckCircle2 className="w-5 h-5 text-emerald-400" /> : <Circle className="w-5 h-5 text-slate-600" />}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      <div className={`${ui.card} p-6`}>
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-1 mb-4">
          <h3 className="font-semibold text-base flex items-center gap-2">
            <Flame className="w-4 h-4 text-amber-400" /> Constancia de hábitos
          </h3>
          <p className="text-xs text-slate-500">Últimas 12 semanas · hoy está marcado</p>
        </div>
        <HabitHeatmap calendar={habitCalendar(health, 12)} />
      </div>

      <div className={`${ui.card} p-6`}>
        <h3 className="font-semibold text-base mb-4 flex items-center gap-2">
          <History className="w-4 h-4 text-emerald-400" /> Historial Diario Archivado
        </h3>
        {(health.dailyLogs || []).length === 0 ? (
          <p className="text-sm text-slate-500">Aún no hay días anteriores archivados.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {[...health.dailyLogs].sort((a, b) => b.date.localeCompare(a.date)).map((log) => (
              <div key={log.date} className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 flex flex-col justify-between gap-2">
                <div className="flex justify-between items-center">
                  <span className="text-sm font-semibold text-slate-200">{formatReadableDate(log.date)}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">{log.habitsDone}/{log.habitsTotal} hábitos</span>
                </div>
                <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/80">
                  <span className="flex items-center gap-1"><Droplets className="w-3.5 h-3.5 text-sky-400" aria-label="Agua" /> <span className="num">{log.water}/{log.waterGoal}</span></span>
                  <span className="flex items-center gap-1"><Moon className="w-3.5 h-3.5 text-indigo-400" aria-label="Sueño" /> <span className="num">{log.sleep == null ? '–' : `${log.sleep} h`}</span></span>
                  <span className="flex items-center gap-1"><Activity className="w-3.5 h-3.5 text-amber-400" aria-label="Energía" /> <span className="num">{log.mood == null ? '–' : `${log.mood}/5`}</span></span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
