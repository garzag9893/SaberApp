// Fusión de datos entre dispositivos.
// - Tareas y movimientos: se combinan elemento por elemento; gana la versión editada más recientemente.
//   Los borrados se recuerdan ("lápidas") para que un elemento eliminado no reaparezca.
// - Salud, presupuestos y ajustes: gana el bloque completo editado más recientemente.

export const stableStringify = (value) => {
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  if (value && typeof value === 'object') {
    return `{${Object.keys(value).sort().filter((k) => value[k] !== undefined)
      .map((k) => `${JSON.stringify(k)}:${stableStringify(value[k])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
};

const MAX_TOMBSTONES = 1000;

const mergeTombstones = (a = {}, b = {}) => {
  const out = { ...a };
  for (const [id, ts] of Object.entries(b)) if (!out[id] || ts > out[id]) out[id] = ts;
  const entries = Object.entries(out);
  if (entries.length <= MAX_TOMBSTONES) return out;
  return Object.fromEntries(entries.sort((x, y) => y[1].localeCompare(x[1])).slice(0, MAX_TOMBSTONES));
};

const mergeItems = (localItems, remoteItems, tombstones) => {
  const byId = new Map(localItems.map((it) => [it.id, it]));
  const remoteOnly = [];
  for (const r of remoteItems) {
    const l = byId.get(r.id);
    if (!l) remoteOnly.push(r);
    else if ((r.updatedAt || '') > (l.updatedAt || '')) byId.set(r.id, r);
  }
  return [...remoteOnly, ...localItems.map((it) => byId.get(it.id))]
    .filter((it) => !(tombstones[it.id] && tombstones[it.id] >= (it.updatedAt || '')));
};

export const mergeData = (local, remote) => {
  const deleted = {
    tasks: mergeTombstones(local.deleted.tasks, remote.deleted.tasks),
    transactions: mergeTombstones(local.deleted.transactions, remote.deleted.transactions),
  };
  // En empate se queda la versión local.
  const pick = (key) => ((remote.stamps[key] || '') > (local.stamps[key] || '') ? remote[key] : local[key]);
  const maxStamp = (key) => ((remote.stamps[key] || '') > (local.stamps[key] || '') ? remote.stamps[key] : local.stamps[key]);

  return {
    ...local,
    tasks: mergeItems(local.tasks, remote.tasks, deleted.tasks),
    transactions: mergeItems(local.transactions, remote.transactions, deleted.transactions),
    health: pick('health'),
    budgets: pick('budgets'),
    settings: pick('settings'),
    deleted,
    stamps: { health: maxStamp('health'), budgets: maxStamp('budgets'), settings: maxStamp('settings') },
  };
};
