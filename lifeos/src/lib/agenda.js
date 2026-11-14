import { isTime, timeToMinutes, sortTasksChronologically } from './dates.js';

export const isOverdue = (task, todayKey) => !task.completed && Boolean(task.date) && task.date < todayKey;

// "Hoy" incluye las tareas pendientes de días anteriores.
export const isForToday = (task, todayKey) => (task.date || todayKey) === todayKey || isOverdue(task, todayKey);

export const todayTasks = (tasks, todayKey) => sortTasksChronologically(tasks.filter((t) => isForToday(t, todayKey)), todayKey);

// Choques de horario entre tareas pendientes del mismo día.
// Sin hora de fin, una tarea ocupa solo su hora de inicio.
// Devuelve { [id]: [títulos con los que choca] }.
export const findConflicts = (tasks) => {
  const timed = tasks
    .filter((t) => !t.completed && isTime(t.time))
    .map((t) => {
      const start = timeToMinutes(t.time);
      const end = isTime(t.endTime) && timeToMinutes(t.endTime) > start ? timeToMinutes(t.endTime) : start;
      return { t, start, end };
    });
  const conflicts = {};
  for (let i = 0; i < timed.length; i += 1) {
    for (let j = i + 1; j < timed.length; j += 1) {
      const a = timed[i];
      const b = timed[j];
      if ((a.t.date || '') !== (b.t.date || '')) continue;
      const overlap = a.start === b.start || (a.start < b.end && b.start < a.end);
      if (!overlap) continue;
      (conflicts[a.t.id] ||= []).push(b.t.title);
      (conflicts[b.t.id] ||= []).push(a.t.title);
    }
  }
  return conflicts;
};

export const formatTimeRange = (task) => {
  if (!isTime(task.time)) return 'Sin hora';
  return isTime(task.endTime) && task.endTime > task.time ? `${task.time}–${task.endTime}` : task.time;
};
