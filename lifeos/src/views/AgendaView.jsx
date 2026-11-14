import { useState, useEffect, useMemo } from 'react';
import {
  Calendar, Plus, CheckCircle2, Circle, Clock, Trash2, Pencil, Flag, Repeat,
  AlertTriangle, Search, ChevronLeft, ChevronRight, X,
} from 'lucide-react';
import { addDaysToKey, formatReadableDate, sortTasksChronologically, startOfWeek, isTime } from '../lib/dates.js';
import { isOverdue, todayTasks, findConflicts, formatTimeRange } from '../lib/agenda.js';
import { REPEAT_OPTIONS, REPEAT_LABEL } from '../lib/recurrence.js';
import { matchesQuery } from '../lib/text.js';
import { ui, PRIORITY, EditActions, Field } from '../components/ui.jsx';

const emptyForm = (date) => ({ title: '', date, time: '', endTime: '', priority: 'medium', repeat: 'none' });

// Valida un formulario de tarea. Devuelve un mensaje de error o null.
const validate = (form) => {
  if (!form.title.trim()) return '⚠️ La tarea necesita un título';
  if (form.endTime && !form.time) return '⚠️ Indica la hora de inicio antes de la hora de fin';
  if (form.endTime && form.endTime <= form.time) return '⚠️ La hora de fin debe ser después de la de inicio';
  return null;
};

const toTask = (form, fallbackDate) => ({
  title: form.title.trim(),
  date: form.date || fallbackDate,
  time: form.time,
  endTime: form.time ? form.endTime : '',
  priority: form.priority,
  repeat: form.repeat,
  repeatAnchor: form.repeat === 'monthly' ? Number((form.date || fallbackDate).slice(8)) : null,
});

function TaskFields({ form, setForm, compact = false }) {
  const input = compact ? ui.inputSm : ui.input;
  const set = (key) => (e) => setForm({ ...form, [key]: e.target.value });
  return (
    <div className="grid grid-cols-2 sm:grid-cols-6 gap-3">
      <Field label="Tarea" className="col-span-2 sm:col-span-6">
        <input type="text" autoFocus={compact} placeholder="¿Qué necesitas hacer? (ej. Revisión médica)" value={form.title} onChange={set('title')} className={input} />
      </Field>
      <Field label="Fecha" className="col-span-2 sm:col-span-2">
        <input type="date" value={form.date} onChange={set('date')} className={input} />
      </Field>
      <Field label="Inicio">
        <input type="time" value={form.time} onChange={set('time')} className={input} />
      </Field>
      <Field label="Fin (opcional)">
        <input type="time" value={form.endTime} onChange={set('endTime')} disabled={!form.time} className={`${input} disabled:opacity-40`} />
      </Field>
      <Field label="Prioridad">
        <select value={form.priority} onChange={set('priority')} className={input}>
          <option value="high">Alta</option>
          <option value="medium">Media</option>
          <option value="low">Baja</option>
        </select>
      </Field>
      <Field label="Repetir">
        <select value={form.repeat} onChange={set('repeat')} className={input}>
          {REPEAT_OPTIONS.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
        </select>
      </Field>
    </div>
  );
}

function TaskRow({ task, todayKey, showDate, conflicts, onToggle, onEdit, onDelete, onMoveToday }) {
  const overdue = isOverdue(task, todayKey);
  const badge = PRIORITY[task.priority] || PRIORITY.medium;
  const clashes = conflicts[task.id];
  return (
    <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-800/40 hover:bg-slate-800/70 border border-slate-800/80 transition-colors">
      <button type="button" onClick={() => onToggle(task.id)} aria-pressed={task.completed} className="flex items-center gap-3 cursor-pointer flex-1 min-w-0 text-left">
        {task.completed ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" /> : <Circle className="w-5 h-5 text-slate-500 shrink-0" />}
        <div className="min-w-0">
          <p className={`text-sm font-medium break-words ${task.completed ? 'line-through text-slate-500' : 'text-slate-100'}`}>{task.title}</p>
          <div className="flex flex-wrap items-center gap-2 mt-1">
            <span className="text-xs text-indigo-400 font-medium flex items-center gap-1">
              <Clock className="w-3 h-3" /> {formatTimeRange(task)}
            </span>
            {overdue ? (
              <span className="text-[11px] text-rose-300 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded-md">
                Atrasada · {formatReadableDate(task.date)}
              </span>
            ) : showDate && (
              <span className="text-[11px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded-md">{formatReadableDate(task.date || todayKey)}</span>
            )}
            <span className={`text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1 ${badge.cls}`}>
              <Flag className="w-2.5 h-2.5" /> {badge.label}
            </span>
            {task.repeat !== 'none' && (
              <span className="text-[10px] px-2 py-0.5 rounded-full border border-sky-500/30 bg-sky-500/10 text-sky-300 flex items-center gap-1">
                <Repeat className="w-2.5 h-2.5" /> {REPEAT_LABEL[task.repeat]}
              </span>
            )}
            {clashes && (
              <span className="text-[10px] px-2 py-0.5 rounded-full border border-amber-500/30 bg-amber-500/10 text-amber-300 flex items-center gap-1" title={`Choca con: ${clashes.join(', ')}`}>
                <AlertTriangle className="w-2.5 h-2.5" /> Choca con {clashes[0]}{clashes.length > 1 ? ` y ${clashes.length - 1} más` : ''}
              </span>
            )}
          </div>
        </div>
      </button>
      <div className="flex items-center gap-1.5 ml-2 shrink-0">
        {overdue && (
          <button onClick={() => onMoveToday(task.id)} className="text-[11px] font-semibold text-indigo-300 hover:text-indigo-200 px-2 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/30" aria-label={`Mover a hoy: ${task.title}`}>
            Mover a hoy
          </button>
        )}
        <button onClick={() => onEdit(task)} className={`${ui.iconBtn} hover:text-indigo-400`} title="Editar tarea" aria-label={`Editar tarea: ${task.title}`}>
          <Pencil className="w-4 h-4" />
        </button>
        <button onClick={() => onDelete(task.id)} className={`${ui.iconBtn} hover:text-rose-400`} title="Eliminar tarea" aria-label={`Eliminar tarea: ${task.title}`}>
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

function WeekView({ tasks, todayKey, weekStart, setWeekStart, conflicts, onToggle, onPickDay }) {
  const days = Array.from({ length: 7 }, (_, i) => addDaysToKey(weekStart, i));
  const byDay = (day) => sortTasksChronologically(tasks.filter((t) => (t.date || todayKey) === day), todayKey);
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-4">
        <button onClick={() => setWeekStart(addDaysToKey(weekStart, -7))} className={ui.iconBtn} aria-label="Semana anterior">
          <ChevronLeft className="w-5 h-5" />
        </button>
        <div className="text-center">
          <p className="text-sm font-semibold text-slate-200">{formatReadableDate(days[0])} – {formatReadableDate(days[6])}</p>
          {weekStart !== startOfWeek(todayKey) && (
            <button onClick={() => setWeekStart(startOfWeek(todayKey))} className="text-[11px] text-indigo-400 hover:underline">Ir a esta semana</button>
          )}
        </div>
        <button onClick={() => setWeekStart(addDaysToKey(weekStart, 7))} className={ui.iconBtn} aria-label="Semana siguiente">
          <ChevronRight className="w-5 h-5" />
        </button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-7 gap-2">
        {days.map((day) => {
          const list = byDay(day);
          const isToday = day === todayKey;
          return (
            <div key={day} className={`rounded-xl border p-2.5 lg:min-h-40 ${isToday ? 'border-indigo-500/60 bg-indigo-500/5' : 'border-slate-800 bg-slate-800/20'}`}>
              <button
                onClick={() => onPickDay(day)}
                className={`w-full flex items-center justify-between text-xs font-semibold mb-2 ${isToday ? 'text-indigo-300' : 'text-slate-300'} hover:text-indigo-300`}
                title="Agendar en este día"
              >
                <span>{formatReadableDate(day)}</span>
                <Plus className="w-3.5 h-3.5 opacity-60" />
              </button>
              {list.length === 0 ? (
                <p className="text-[11px] text-slate-600">Libre</p>
              ) : (
                <div className="space-y-1.5">
                  {list.map((task) => (
                    <button
                      key={task.id}
                      onClick={() => onToggle(task.id)}
                      aria-pressed={task.completed}
                      title={conflicts[task.id] ? `Choca con: ${conflicts[task.id].join(', ')}` : task.title}
                      className={`w-full text-left text-[11px] leading-snug px-2 py-1.5 rounded-lg border ${
                        conflicts[task.id] ? 'border-amber-500/40 bg-amber-500/10' : 'border-slate-700/60 bg-slate-900/60'
                      } hover:border-indigo-500/50`}
                    >
                      <span className="block text-indigo-400 font-medium">
                        {isTime(task.time) ? formatTimeRange(task) : 'Sin hora'}
                        {task.repeat !== 'none' && <Repeat className="inline w-2.5 h-2.5 ml-1" />}
                      </span>
                      <span className={`block break-words ${task.completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>{task.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function AgendaView({ tasks, todayKey, onAdd, onUpdate, onToggle, onDelete, showToast }) {
  const [mode, setMode] = useState('today'); // 'today' | 'tomorrow' | 'week' | 'custom' | 'all'
  const [customDate, setCustomDate] = useState(todayKey);
  const [weekStart, setWeekStart] = useState(() => startOfWeek(todayKey));
  const [query, setQuery] = useState('');
  const [form, setForm] = useState(() => emptyForm(todayKey));
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState(() => emptyForm(todayKey));

  // Al cambiar de día, los selectores vuelven a la nueva fecha.
  useEffect(() => {
    setCustomDate(todayKey);
    setWeekStart(startOfWeek(todayKey));
    setForm((f) => ({ ...f, date: todayKey }));
  }, [todayKey]);

  const tomorrowKey = addDaysToKey(todayKey, 1);
  const searching = query.trim() !== '';
  const conflicts = useMemo(() => findConflicts(tasks), [tasks]);

  const list = useMemo(() => {
    if (searching) return sortTasksChronologically(tasks.filter((t) => matchesQuery(t.title, query)), todayKey);
    if (mode === 'today') return todayTasks(tasks, todayKey);
    if (mode === 'all') return sortTasksChronologically(tasks, todayKey);
    const day = mode === 'tomorrow' ? tomorrowKey : customDate;
    return sortTasksChronologically(tasks.filter((t) => (t.date || todayKey) === day), todayKey);
  }, [tasks, todayKey, tomorrowKey, mode, customDate, query, searching]);

  const handleAdd = (e) => {
    e.preventDefault();
    const error = validate(form);
    if (error) {
      showToast(error);
      return;
    }
    onAdd(toTask(form, todayKey));
    setForm((f) => ({ ...emptyForm(f.date), priority: f.priority }));
    showToast(`📅 Tarea agregada${form.repeat !== 'none' ? ` (${REPEAT_LABEL[form.repeat].toLowerCase()})` : ''}`);
  };

  const startEditing = (task) => {
    setEditingId(task.id);
    setEditForm({
      title: task.title,
      date: task.date || todayKey,
      time: task.time || '',
      endTime: task.endTime || '',
      priority: task.priority || 'medium',
      repeat: task.repeat || 'none',
    });
  };

  const saveEditing = (e) => {
    e.preventDefault();
    const error = validate(editForm);
    if (error) {
      showToast(error);
      return;
    }
    onUpdate(editingId, toTask(editForm, todayKey));
    setEditingId(null);
    showToast('✅ Tarea actualizada');
  };

  const selectMode = (id) => {
    setMode(id);
    setQuery('');
    if (id === 'today') setForm((f) => ({ ...f, date: todayKey }));
    if (id === 'tomorrow') setForm((f) => ({ ...f, date: tomorrowKey }));
  };

  const filterTabs = [
    { id: 'today', label: `Hoy (${formatReadableDate(todayKey)})` },
    { id: 'tomorrow', label: 'Mañana' },
    { id: 'week', label: 'Semana' },
    { id: 'all', label: 'Todas' },
  ];

  return (
    <div className="space-y-6">
      <div className={`${ui.card} p-5`}>
        <h3 className="font-semibold text-sm text-slate-200 mb-3 flex items-center gap-2">
          <Plus className="w-4 h-4 text-indigo-400" /> Programar Nuevo Bloque o Tarea
        </h3>
        <form onSubmit={handleAdd} className="space-y-3">
          <TaskFields form={form} setForm={setForm} />
          <div className="flex justify-end">
            <button type="submit" className={`${ui.primary} px-5 py-2.5 text-sm`}>Crear tarea</button>
          </div>
        </form>
      </div>

      <div className={`${ui.card} p-6`}>
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
          <div className="flex flex-wrap items-center gap-2">
            {filterTabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => selectMode(tab.id)}
                aria-pressed={!searching && mode === tab.id}
                className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                  !searching && mode === tab.id ? 'bg-indigo-600 text-white shadow-md' : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
            <div className={`flex items-center gap-1.5 bg-slate-800 px-2.5 py-1 rounded-xl border ${!searching && mode === 'custom' ? 'border-indigo-500' : 'border-slate-700'}`}>
              <Calendar className="w-3.5 h-3.5 text-indigo-400" />
              <input
                type="date"
                aria-label="Ver otra fecha"
                value={customDate}
                onChange={(e) => {
                  const value = e.target.value;
                  setCustomDate(value);
                  setQuery('');
                  setMode(value ? 'custom' : 'today');
                  setForm((f) => ({ ...f, date: value || todayKey }));
                }}
                className="bg-transparent text-xs text-slate-200 focus:outline-none"
              />
            </div>
          </div>
          <div className="relative w-full xl:w-64">
            <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Buscar en todas las tareas…"
              aria-label="Buscar tareas"
              className="w-full bg-slate-800/70 border border-slate-700 rounded-xl pl-9 pr-8 py-2 text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500"
            />
            {searching && (
              <button onClick={() => setQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300" aria-label="Limpiar búsqueda">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>

        {!searching && mode === 'week' ? (
          <WeekView
            tasks={tasks}
            todayKey={todayKey}
            weekStart={weekStart}
            setWeekStart={setWeekStart}
            conflicts={conflicts}
            onToggle={onToggle}
            onPickDay={(day) => {
              setForm((f) => ({ ...f, date: day }));
              window.scrollTo({ top: 0, behavior: 'smooth' });
              showToast(`📅 Formulario listo para ${formatReadableDate(day)}`);
            }}
          />
        ) : (
          <>
            <p className="text-xs text-slate-400 mb-3">
              {searching
                ? `${list.length} ${list.length === 1 ? 'resultado' : 'resultados'} para "${query.trim()}"`
                : `${list.filter((t) => t.completed).length} de ${list.length} completadas`}
            </p>
            {list.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="w-10 h-10 text-slate-700 mx-auto mb-2" />
                <p className="text-sm text-slate-400">{searching ? 'Ninguna tarea coincide con la búsqueda.' : 'No hay tareas programadas para esta vista.'}</p>
                {!searching && <p className="text-xs text-slate-500 mt-1">Usa el formulario de arriba o la entrada rápida para agendar.</p>}
              </div>
            ) : (
              <div className="space-y-3">
                {list.map((task) => (editingId === task.id ? (
                  <form
                    key={task.id}
                    onSubmit={saveEditing}
                    onKeyDown={(e) => { if (e.key === 'Escape') setEditingId(null); }}
                    className="p-4 rounded-xl bg-slate-800 border border-indigo-500/50 space-y-3"
                  >
                    <TaskFields form={editForm} setForm={setEditForm} compact />
                    <EditActions onCancel={() => setEditingId(null)} />
                  </form>
                ) : (
                  <TaskRow
                    key={task.id}
                    task={task}
                    todayKey={todayKey}
                    showDate={searching || mode === 'all'}
                    conflicts={conflicts}
                    onToggle={onToggle}
                    onEdit={startEditing}
                    onDelete={onDelete}
                    onMoveToday={(id) => {
                      onUpdate(id, { date: todayKey });
                      showToast('📅 Tarea movida a hoy');
                    }}
                  />
                )))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
