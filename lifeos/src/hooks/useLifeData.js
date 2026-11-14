import { useState, useEffect, useRef, useMemo } from 'react';
import { loadData, saveData, sanitizeData, sanitizeTasks, sanitizeTransactions } from '../lib/storage.js';
import { toggleTask } from '../lib/recurrence.js';
import { applyRecurringTx } from '../lib/recurringTx.js';
import { mergeData } from '../lib/merge.js';
import { newId } from '../components/ui.jsx';

const nowIso = () => new Date().toISOString();

// Todos los datos de la app en un solo objeto, guardado en localStorage.
// Cada cambio marca su fecha de edición para poder fusionar entre dispositivos.
export function useLifeData({ onSaveError } = {}) {
  const [data, setData] = useState(loadData);
  const dataRef = useRef(data);
  dataRef.current = data;
  const onSaveErrorRef = useRef(onSaveError);
  onSaveErrorRef.current = onSaveError;

  useEffect(() => {
    if (!saveData(data)) onSaveErrorRef.current?.();
  }, [data]);

  const ops = useMemo(() => {
    const add = (coll, sanitize) => (fields) => {
      const item = { ...sanitize([{ ...fields, id: newId() }])[0], updatedAt: nowIso() };
      setData((d) => ({ ...d, [coll]: [item, ...d[coll]] }));
      return item;
    };
    const update = (coll) => (id, patch) => {
      const now = nowIso();
      setData((d) => ({ ...d, [coll]: d[coll].map((x) => (x.id === id ? { ...x, ...patch, updatedAt: now } : x)) }));
    };
    // Devuelve { item, index } para poder deshacer.
    const remove = (coll) => (id) => {
      const list = dataRef.current[coll];
      const index = list.findIndex((x) => x.id === id);
      if (index < 0) return null;
      const now = nowIso();
      setData((d) => ({
        ...d,
        [coll]: d[coll].filter((x) => x.id !== id),
        deleted: { ...d.deleted, [coll]: { ...d.deleted[coll], [id]: now } },
      }));
      return { item: list[index], index };
    };
    const restore = (coll) => (item, index) => {
      const now = nowIso();
      setData((d) => {
        if (d[coll].some((x) => x.id === item.id)) return d;
        const tombstones = { ...d.deleted[coll] };
        delete tombstones[item.id];
        const list = [...d[coll]];
        list.splice(Math.min(index, list.length), 0, { ...item, updatedAt: now });
        return { ...d, [coll]: list, deleted: { ...d.deleted, [coll]: tombstones } };
      });
    };
    const withSettings = (fn) => setData((d) => ({ ...d, settings: fn(d.settings), stamps: { ...d.stamps, settings: nowIso() } }));

    return {
      addTask: add('tasks', sanitizeTasks),
      updateTask: update('tasks'),
      removeTask: remove('tasks'),
      restoreTask: restore('tasks'),
      toggleTask: (id) => {
        const now = nowIso();
        setData((d) => {
          const r = toggleTask(d.tasks, id, d.health.lastActiveDate, { newId, now });
          if (!r.removedIds.length) return { ...d, tasks: r.tasks };
          const tombstones = { ...d.deleted.tasks };
          r.removedIds.forEach((x) => { tombstones[x] = now; });
          return { ...d, tasks: r.tasks, deleted: { ...d.deleted, tasks: tombstones } };
        });
      },

      addTx: add('transactions', sanitizeTransactions),
      updateTx: update('transactions'),
      removeTx: remove('transactions'),
      restoreTx: restore('transactions'),

      // stamp: false para cambios automáticos (cambio de día) que no deben ganarle a ediciones reales.
      updateHealth: (fn, { stamp = true } = {}) => setData((d) => {
        const health = fn(d.health);
        if (health === d.health) return d;
        return { ...d, health, stamps: stamp ? { ...d.stamps, health: nowIso() } : d.stamps };
      }),

      setBudgets: (budgets) => setData((d) => ({ ...d, budgets, stamps: { ...d.stamps, budgets: nowIso() } })),

      addRule: (rule) => withSettings((s) => ({ ...s, recurringTx: [...s.recurringTx, { ...rule, id: newId() }] })),
      removeRule: (id) => withSettings((s) => ({ ...s, recurringTx: s.recurringTx.filter((r) => r.id !== id) })),

      // Operaciones de categorías (lib/categories.js): fn(data, now) → { data, error? }.
      // Devuelve el resultado para mostrar errores o cuántos movimientos se movieron.
      categoryOp: (fn) => {
        const now = nowIso();
        const result = fn(dataRef.current, now);
        if (!result.error) setData((d) => fn(d, now).data);
        return result;
      },

      applyRecurring: (todayKey) => setData((d) => applyRecurringTx(d, todayKey, nowIso())),

      applyRemote: (remote) => setData((d) => mergeData(d, remote)),

      // Reemplaza todo (empezar desde cero, o deshacer un borrado total). Lo que había se borra
      // también de la nube. Devuelve los datos anteriores para poder deshacer.
      replaceAll: (next) => {
        const prev = dataRef.current;
        const now = nowIso();
        const tombstonesFor = (coll) => {
          const keep = new Set(next[coll].map((x) => x.id));
          const out = { ...prev.deleted[coll] };
          prev[coll].forEach((x) => { if (!keep.has(x.id)) out[x.id] = now; });
          next[coll].forEach((x) => { delete out[x.id]; });
          return out;
        };
        setData({
          ...next,
          tasks: next.tasks.map((t) => ({ ...t, updatedAt: now })),
          transactions: next.transactions.map((t) => ({ ...t, updatedAt: now })),
          deleted: { tasks: tombstonesFor('tasks'), transactions: tombstonesFor('transactions') },
          stamps: { health: now, budgets: now, settings: now },
        });
        return prev;
      },

      // Restaura un respaldo. Lo restaurado se marca como la versión más reciente, y lo que no
      // venía en el respaldo se borra también de la nube.
      importData: (raw) => {
        const cur = dataRef.current;
        const parsed = sanitizeData(raw, cur);
        const recognized = ['tasks', 'transactions', 'health'].some((k) => raw && raw[k] !== undefined && parsed[k] !== cur[k]);
        if (!recognized) return false;
        const now = nowIso();
        const tombstonesFor = (coll) => {
          const keep = new Set(parsed[coll].map((x) => x.id));
          const out = { ...cur.deleted[coll] };
          cur[coll].forEach((x) => { if (!keep.has(x.id)) out[x.id] = now; });
          parsed[coll].forEach((x) => { delete out[x.id]; });
          return out;
        };
        setData({
          ...parsed,
          tasks: parsed.tasks.map((t) => ({ ...t, updatedAt: now })),
          transactions: parsed.transactions.map((t) => ({ ...t, updatedAt: now })),
          deleted: { tasks: tombstonesFor('tasks'), transactions: tombstonesFor('transactions') },
          stamps: { health: now, budgets: now, settings: now },
        });
        return true;
      },
    };
  }, []);

  return { data, dataRef, ...ops };
}
