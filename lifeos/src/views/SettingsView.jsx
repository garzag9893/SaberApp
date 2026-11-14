import { useState, useEffect, useRef } from 'react';
import { Palette, Bell, Tags, Moon, Sun, Monitor, Trash2, Plus, Database, Download, Upload, FileSpreadsheet, RotateCcw, Smartphone, UserRound, Sparkles } from 'lucide-react';
import { addCategory, renameCategory, recolorCategory, removeCategory } from '../lib/categories.js';
import { notificationsSupported, showSystemNotification } from '../hooks/useReminders.js';
import { ui, SectionTitle } from '../components/ui.jsx';

function CategoryRow({ category, canDelete, onRename, onRecolor, onRemove }) {
  const [name, setName] = useState(category.name);
  useEffect(() => setName(category.name), [category.name]);
  const commit = () => {
    if (name.trim() === category.name) {
      setName(category.name);
      return;
    }
    if (!onRename(category.name, name)) setName(category.name);
  };
  return (
    <div className="flex items-center gap-2">
      <input
        type="color" value={category.color} onChange={(e) => onRecolor(category.name, e.target.value)}
        aria-label={`Color de ${category.name}`} title="Cambiar color"
        className="w-9 h-9 shrink-0 rounded-lg border border-slate-700 bg-transparent cursor-pointer p-1"
      />
      <input
        type="text" value={name} aria-label={`Nombre de la categoría ${category.name}`}
        onChange={(e) => setName(e.target.value)} onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
          if (e.key === 'Escape') {
            setName(category.name);
            e.currentTarget.blur();
          }
        }}
        className={`${ui.inputSm} flex-1 min-w-0`}
      />
      <button
        onClick={() => onRemove(category.name)} disabled={!canDelete}
        className={`${ui.iconBtn} hover:text-rose-400 disabled:opacity-30 disabled:hover:text-slate-400`}
        aria-label={`Eliminar categoría ${category.name}`}
        title={canDelete ? 'Eliminar categoría' : 'Debe quedar al menos una'}
      >
        <Trash2 className="w-4 h-4" />
      </button>
    </div>
  );
}

function CategoryList({ title, type, list, categoryOp, showToast }) {
  const [newName, setNewName] = useState('');
  const run = (fn, success) => {
    const result = categoryOp(fn);
    if (result.error) {
      showToast(`⚠️ ${result.error}`);
      return false;
    }
    if (success) showToast(success(result));
    return true;
  };
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-semibold text-slate-200">{title}</h4>
      {list.map((c) => (
        <CategoryRow
          key={c.name}
          category={c}
          canDelete={list.length > 1}
          onRename={(oldName, value) => run((d, now) => renameCategory(d, type, oldName, value, now), () => '✅ Categoría renombrada')}
          onRecolor={(name, color) => categoryOp((d, now) => ({ data: recolorCategory(d, type, name, color, now) }))}
          onRemove={(name) => run(
            (d, now) => removeCategory(d, type, name, now),
            (r) => (r.moved ? `🗑️ "${name}" eliminada; ${r.moved} ${r.moved === 1 ? 'movimiento pasó' : 'movimientos pasaron'} a "${r.fallback}"` : `🗑️ Categoría "${name}" eliminada`),
          )}
        />
      ))}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (run((d, now) => addCategory(d, type, newName, now), () => `✅ Categoría "${newName.trim()}" agregada`)) setNewName('');
        }}
        className="flex items-center gap-2 pt-1"
      >
        <input
          type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nueva categoría"
          aria-label={`Nueva categoría de ${title.toLowerCase()}`}
          className={`${ui.inputSm} flex-1 min-w-0 border-dashed`}
        />
        <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 shrink-0">
          <Plus className="w-3.5 h-3.5" /> Agregar
        </button>
      </form>
    </div>
  );
}

export default function SettingsView({ prefs, setPrefs, settings, categoryOp, showToast, onExportJSON, onExportCSV, onImportFile, onSimulateDay, install, onShowWelcome, onClearAll }) {
  const [confirmClear, setConfirmClear] = useState(false);
  const fileRef = useRef(null);
  const supported = notificationsSupported();
  const [permission, setPermission] = useState(() => (supported ? Notification.permission : 'unsupported'));

  const setReminders = (patch) => setPrefs((p) => ({ ...p, reminders: { ...p.reminders, ...patch } }));

  const toggleReminders = async () => {
    if (prefs.reminders.enabled) {
      setReminders({ enabled: false });
      return;
    }
    let result = permission;
    if (supported && permission === 'default') {
      result = await Notification.requestPermission();
      setPermission(result);
    }
    setReminders({ enabled: true });
    showToast(result === 'granted'
      ? '🔔 Recordatorios activados'
      : '🔔 Recordatorios activados dentro de la app (el navegador no permitió notificaciones del sistema)');
  };

  const themes = [
    { id: 'dark', label: 'Oscuro', icon: Moon },
    { id: 'light', label: 'Claro', icon: Sun },
    { id: 'system', label: 'Según el dispositivo', icon: Monitor },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Ajustes</h2>

      <div className={`${ui.card} p-6 space-y-4`}>
        <SectionTitle icon={UserRound} sub="Se usa para saludarte en el Resumen. Se guarda en este dispositivo.">Tú</SectionTitle>
        <div className="flex flex-col sm:flex-row sm:items-end gap-3">
          <label className="block flex-1 max-w-sm">
            <span className={ui.label}>Nombre</span>
            <input
              type="text" value={prefs.name} maxLength={40} placeholder="Tu nombre" autoComplete="given-name"
              onChange={(e) => setPrefs((p) => ({ ...p, name: e.target.value }))}
              className={ui.input}
            />
          </label>
          <button onClick={onShowWelcome} className={`${ui.link} sm:mb-3`}>
            <Sparkles className="w-3.5 h-3.5" /> Ver el recorrido de bienvenida
          </button>
        </div>
      </div>

      <div className={`${ui.card} p-6 space-y-4`}>
        <SectionTitle icon={Palette} sub="Se guarda en este dispositivo.">Tema</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {themes.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setPrefs((p) => ({ ...p, theme: id }))}
              aria-pressed={prefs.theme === id}
              className={`flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm border transition-all ${
                prefs.theme === id ? 'bg-indigo-600/20 border-indigo-500 text-indigo-300' : 'bg-slate-800/50 border-slate-700 text-slate-400 hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" /> {label}
            </button>
          ))}
        </div>
      </div>

      <div className={`${ui.card} p-6 space-y-4`}>
        <SectionTitle icon={Bell} iconClass="text-amber-400" sub="Avisa antes de las tareas con hora de hoy.">Recordatorios</SectionTitle>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <button
            onClick={toggleReminders}
            role="switch"
            aria-checked={prefs.reminders.enabled}
            className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${prefs.reminders.enabled ? 'bg-emerald-500' : 'bg-slate-700'}`}
          >
            <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white transition-transform ${prefs.reminders.enabled ? 'translate-x-5' : ''}`} />
            <span className="sr-only">Activar recordatorios</span>
          </button>
          <label className="flex items-center gap-2 text-sm text-slate-300">
            Avisar
            <select
              value={prefs.reminders.minutesBefore}
              onChange={(e) => setReminders({ minutesBefore: Number(e.target.value) })}
              className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
            >
              <option value={0}>a la hora exacta</option>
              <option value={5}>5 minutos antes</option>
              <option value={10}>10 minutos antes</option>
              <option value={15}>15 minutos antes</option>
              <option value={30}>30 minutos antes</option>
              <option value={60}>1 hora antes</option>
            </select>
          </label>
          {prefs.reminders.enabled && permission === 'granted' && (
            <button
              onClick={async () => {
                const ok = await showSystemNotification('LifeOS', 'Así se verán tus recordatorios.', 'lifeos-test');
                if (!ok) showToast('⚠️ No se pudo mostrar la notificación de prueba');
              }}
              className={ui.link}
            >
              Probar notificación
            </button>
          )}
        </div>
        <p className="text-xs text-slate-500">
          {!supported && 'Este navegador no admite notificaciones; los avisos aparecerán dentro de la app. '}
          {supported && permission === 'denied' && 'Las notificaciones están bloqueadas para este sitio; permítelas en la configuración del navegador. Mientras tanto, los avisos aparecen dentro de la app. '}
          Los recordatorios funcionan mientras LifeOS esté abierta (también instalada como app en segundo plano). Con la app cerrada por completo el navegador no puede avisar.
        </p>
      </div>

      <div className={`${ui.card} p-6 space-y-5`}>
        <SectionTitle icon={Tags} iconClass="text-emerald-400" sub="Al renombrar o eliminar, se actualizan tus movimientos, presupuestos y gastos fijos.">Categorías</SectionTitle>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CategoryList title="Gastos" type="expense" list={settings.expenseCategories} categoryOp={categoryOp} showToast={showToast} />
          <CategoryList title="Ingresos" type="income" list={settings.incomeCategories} categoryOp={categoryOp} showToast={showToast} />
        </div>
      </div>

      <div className={`${ui.card} p-6 space-y-4`}>
        <SectionTitle icon={Database} iconClass="text-sky-400" sub="Descarga una copia de todo o restaura una que guardaste.">Datos y respaldo</SectionTitle>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          <button onClick={onExportJSON} className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm border border-slate-700 bg-slate-800/50 text-slate-200 hover:bg-slate-800">
            <Download className="w-4 h-4 text-indigo-400" /> Descargar respaldo
          </button>
          <button onClick={onExportCSV} className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm border border-slate-700 bg-slate-800/50 text-slate-200 hover:bg-slate-800">
            <FileSpreadsheet className="w-4 h-4 text-emerald-400" /> Movimientos en Excel
          </button>
          <button onClick={() => fileRef.current?.click()} className="flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm border border-dashed border-slate-600 text-slate-300 hover:bg-slate-800">
            <Upload className="w-4 h-4" /> Restaurar respaldo
          </button>
          <input
            type="file" accept=".json,application/json" ref={fileRef} className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) onImportFile(file);
              e.target.value = '';
            }}
          />
        </div>
        <div className="flex flex-wrap gap-x-5 gap-y-2 pt-1">
          {install.canInstall && (
            <button onClick={install.install} className={ui.link}><Smartphone className="w-3.5 h-3.5" /> Instalar como app</button>
          )}
          <button onClick={onSimulateDay} className={ui.link} title="Archiva el día actual y empieza el siguiente">
            <RotateCcw className="w-3.5 h-3.5" /> Simular nuevo día
          </button>
        </div>

        <div className="border-t border-slate-800 pt-4">
          {confirmClear ? (
            <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-4" role="alertdialog" aria-label="Confirmar borrar todo">
              <p className="text-sm text-slate-100 font-medium">¿Borrar tareas, movimientos y hábitos?</p>
              <p className="text-xs text-slate-400 mt-1">Las categorías y tus ajustes se conservan. Podrás deshacerlo justo después.</p>
              <div className="flex gap-2 mt-3">
                <button
                  onClick={() => { onClearAll(); setConfirmClear(false); }}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white"
                >
                  Sí, borrar todo
                </button>
                <button onClick={() => setConfirmClear(false)} className="px-3 py-1.5 rounded-lg text-xs bg-slate-700 text-slate-200 hover:bg-slate-600">
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <button onClick={() => setConfirmClear(true)} className="text-xs text-rose-400 hover:underline flex items-center gap-1">
              <Trash2 className="w-3.5 h-3.5" /> Borrar todos los datos y empezar de cero
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
