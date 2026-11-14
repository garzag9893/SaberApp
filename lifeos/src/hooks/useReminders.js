import { useEffect } from 'react';
import { getTodayKey, isTime } from '../lib/dates.js';
import { formatTimeRange } from '../lib/agenda.js';

const NOTIFIED_KEY = 'lifeos_notified_v6';

const loadNotified = () => {
  try {
    const list = JSON.parse(localStorage.getItem(NOTIFIED_KEY));
    return Array.isArray(list) ? list : [];
  } catch {
    return [];
  }
};

const saveNotified = (list) => {
  try { localStorage.setItem(NOTIFIED_KEY, JSON.stringify(list.slice(-200))); } catch { /* sin almacenamiento */ }
};

export const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window;

export async function showSystemNotification(title, body, tag) {
  if (!notificationsSupported() || Notification.permission !== 'granted') return false;
  const options = { body, tag, icon: './icon-192.png', badge: './icon-192.png' };
  try {
    const reg = await navigator.serviceWorker?.getRegistration();
    if (reg) await reg.showNotification(title, options);
    else new Notification(title, options); // eslint-disable-line no-new
    return true;
  } catch {
    return false;
  }
}

// Avisa antes de cada tarea con hora de hoy. Funciona mientras la app esté abierta
// (también instalada y en segundo plano); con la app cerrada el navegador no la ejecuta.
export function useReminders({ tasks, enabled, minutesBefore, showToast }) {
  useEffect(() => {
    if (!enabled) return undefined;
    const check = () => {
      const today = getTodayKey();
      const now = Date.now();
      const notified = loadNotified();
      let changed = false;
      for (const task of tasks) {
        if (task.completed || task.date !== today || !isTime(task.time)) continue;
        const [h, m] = task.time.split(':').map(Number);
        const start = new Date();
        start.setHours(h, m, 0, 0);
        const fireAt = start.getTime() - minutesBefore * 60_000;
        // Solo avisa dentro de la ventana [aviso, inicio + 15 min], para no avisar de algo que ya pasó.
        if (now < fireAt || now > start.getTime() + 15 * 60_000) continue;
        const key = `${task.id}|${task.date}|${task.time}`;
        if (notified.includes(key)) continue;
        notified.push(key);
        changed = true;
        const minutesLeft = Math.ceil((start.getTime() - now) / 60_000);
        const when = minutesLeft > 0 ? `En ${minutesLeft} min` : 'Ahora';
        const body = `${when} · ${formatTimeRange(task)}`;
        showToast(`⏰ ${task.title} — ${body}`);
        showSystemNotification(task.title, body, key);
      }
      if (changed) saveNotified(notified);
    };
    check();
    const interval = setInterval(check, 30_000);
    return () => clearInterval(interval);
  }, [tasks, enabled, minutesBefore, showToast]);
}
