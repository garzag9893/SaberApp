import { useState, useEffect, useCallback } from 'react';
import Sidebar, { BottomNav } from './components/Sidebar.jsx';
import Toast from './components/Toast.jsx';
import QuickAddBar from './components/QuickAddBar.jsx';
import DashboardView from './views/DashboardView.jsx';
import FinancesView from './views/FinancesView.jsx';
import HealthView from './views/HealthView.jsx';
import AgendaView from './views/AgendaView.jsx';
import SettingsView from './views/SettingsView.jsx';
import WelcomeView from './views/WelcomeView.jsx';
import { useToast } from './hooks/useToast.js';
import { useLifeData } from './hooks/useLifeData.js';
import { useCloudSync } from './hooks/useCloudSync.js';
import { useReminders } from './hooks/useReminders.js';
import { useTheme } from './hooks/useTheme.js';
import { useInstallPrompt } from './hooks/useInstallPrompt.js';
import { getTodayKey, addDaysToKey, formatReadableDate } from './lib/dates.js';
import { rollDay } from './lib/habits.js';
import { parseQuickAdd } from './lib/quickAdd.js';
import { categoryNames } from './lib/categories.js';
import { REPEAT_LABEL } from './lib/recurrence.js';
import { loadPrefs, savePrefs, emptyData } from './lib/storage.js';
import { money } from './components/ui.jsx';

const MAX_WATER = 15;

const downloadBlob = (blob, filename) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

export default function LifeOSApp() {
  const { toast, showToast, dismissToast } = useToast();
  const store = useLifeData({
    onSaveError: () => showToast('⚠️ No se pudo guardar en este navegador (almacenamiento lleno o bloqueado)'),
  });
  const { data } = store;
  const todayKey = data.health.lastActiveDate;

  const [activeTab, setActiveTab] = useState('dashboard');
  const [prefs, setPrefs] = useState(loadPrefs);
  useEffect(() => { savePrefs(prefs); }, [prefs]);

  useTheme(prefs.theme);
  const install = useInstallPrompt(useCallback(() => showToast('📱 LifeOS se instaló en este dispositivo'), [showToast]));
  const cloud = useCloudSync({ data, dataRef: store.dataRef, applyRemote: store.applyRemote, showToast });
  useReminders({ tasks: data.tasks, enabled: prefs.reminders.enabled, minutesBefore: prefs.reminders.minutesBefore, showToast });

  // --- CAMBIO DE DÍA ---
  // simOffset = días adelantados con "Simular Nuevo Día" (solo en este dispositivo).
  const { updateHealth, applyRecurring } = store;
  useEffect(() => {
    const check = () => {
      const expected = getTodayKey(prefs.simOffset);
      if (store.dataRef.current.health.lastActiveDate === expected) return;
      updateHealth((prev) => rollDay(prev, expected), { stamp: false });
      showToast(`🌅 ¡Nuevo día (${formatReadableDate(expected)})! Hábitos, agua, sueño y energía reiniciados.`);
    };
    check();
    const interval = setInterval(check, 60_000);
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [todayKey, prefs.simOffset, updateHealth, showToast, store.dataRef]);

  // --- GASTOS E INGRESOS FIJOS ---
  useEffect(() => { applyRecurring(todayKey); }, [todayKey, data.settings.recurringTx, applyRecurring]);

  // --- BORRADO CON "DESHACER" ---
  const deleteTask = (id) => {
    const removed = store.removeTask(id);
    if (removed) showToast(`🗑️ Tarea eliminada: ${removed.item.title}`, { label: 'Deshacer', onClick: () => store.restoreTask(removed.item, removed.index) });
  };
  const deleteTx = (id) => {
    const removed = store.removeTx(id);
    if (removed) showToast(`🗑️ Movimiento eliminado: ${removed.item.desc}`, { label: 'Deshacer', onClick: () => store.restoreTx(removed.item, removed.index) });
  };

  // --- ENTRADA RÁPIDA ---
  const handleQuickAdd = (text) => {
    const parsed = parseQuickAdd(text, todayKey, {
      categories: { expense: categoryNames(data.settings, 'expense'), income: categoryNames(data.settings, 'income') },
    });
    if (parsed.kind === 'transaction') {
      if (!(parsed.amount > 0)) {
        showToast('⚠️ El monto debe ser mayor a $0');
        return false;
      }
      store.addTx({ desc: parsed.desc, amount: parsed.amount, type: parsed.type, category: parsed.category, date: todayKey });
      showToast(`💰 ${parsed.type === 'income' ? 'Ingreso' : 'Gasto'} de $${money(parsed.amount)} (${parsed.category}) registrado`);
    } else if (parsed.kind === 'water') {
      updateHealth((prev) => ({ ...prev, water: Math.min(prev.water + parsed.glasses, MAX_WATER) }));
      showToast(`💧 +${parsed.glasses} ${parsed.glasses === 1 ? 'vaso' : 'vasos'} de agua registrado hoy`);
    } else {
      store.addTask({
        title: parsed.title, date: parsed.date, time: parsed.time, priority: 'medium', completed: false,
        repeat: parsed.repeat, repeatAnchor: parsed.repeatAnchor,
      });
      const dayLabel = parsed.date === todayKey ? 'hoy' : parsed.date === addDaysToKey(todayKey, 1) ? 'mañana' : formatReadableDate(parsed.date);
      const repeatLabel = parsed.repeat !== 'none' ? ` · se repite: ${REPEAT_LABEL[parsed.repeat].toLowerCase()}` : '';
      showToast(`📅 Agendado para ${dayLabel}${parsed.time ? ` a las ${parsed.time}` : ''}${repeatLabel}`);
    }
    return true;
  };

  // --- RESPALDOS ---
  const exportJSON = () => {
    const backup = { ...store.dataRef.current, exportedAt: new Date().toISOString() };
    downloadBlob(new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }), `LifeOS_Respaldo_${todayKey}.json`);
    showToast('📦 Respaldo completo (.JSON) descargado');
  };

  const exportCSV = (list = data.transactions, label = todayKey) => {
    // Comillas en todo texto; el apóstrofo inicial evita que Excel ejecute fórmulas (=, +, -, @).
    const cell = (value) => {
      let s = String(value ?? '');
      if (/^[=+\-@]/.test(s)) s = `'${s}`;
      return `"${s.replace(/"/g, '""')}"`;
    };
    const rows = list.map((t) => [cell(t.id), cell(t.desc), t.amount, t.type === 'income' ? 'Ingreso' : 'Gasto', cell(t.category), t.date].join(','));
    const csv = ['ID,Descripcion,Monto,Tipo,Categoria,Fecha', ...rows].join('\r\n');
    // El BOM (﻿) hace que Excel lea los acentos como UTF-8.
    downloadBlob(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }), `LifeOS_Finanzas_${label}.csv`);
    showToast('📊 Reporte financiero (.CSV) exportado');
  };

  const importFile = (file, onSuccess) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        if (!store.importData(JSON.parse(event.target.result))) throw new Error('Respaldo sin datos reconocibles');
        showToast('✅ Datos restaurados exitosamente');
        onSuccess?.();
      } catch {
        showToast('❌ Error: Archivo de respaldo inválido');
      }
    };
    reader.onerror = () => showToast('❌ Error: No se pudo leer el archivo');
    reader.readAsText(file);
  };

  // --- BIENVENIDA ---
  const [showWelcome, setShowWelcome] = useState(() => !prefs.onboarded);
  const finishWelcome = ({ name, start }) => {
    if (start === 'empty') store.replaceAll(emptyData());
    setPrefs((p) => ({ ...p, onboarded: true, name }));
    setShowWelcome(false);
    setActiveTab('dashboard');
    window.scrollTo(0, 0);
  };

  // --- BORRAR TODO (con deshacer) ---
  const clearAll = () => {
    const previous = store.replaceAll(emptyData());
    showToast('🗑️ Se borraron tareas, movimientos y hábitos', { label: 'Deshacer', onClick: () => store.replaceAll(previous) });
  };

  if (showWelcome) {
    return (
      <>
        <Toast toast={toast} onDismiss={dismissToast} />
        <WelcomeView
          todayKey={todayKey}
          categories={{ expense: categoryNames(data.settings, 'expense'), income: categoryNames(data.settings, 'income') }}
          initialName={prefs.name}
          revisit={prefs.onboarded}
          onFinish={finishWelcome}
          onImportFile={importFile}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col md:flex-row">
      <a
        href="#contenido"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2.5 focus:rounded-xl focus:bg-indigo-600 focus:text-white focus:text-sm focus:font-semibold"
      >
        Saltar al contenido
      </a>
      <Toast toast={toast} onDismiss={dismissToast} />

      <Sidebar
        activeTab={activeTab}
        onTab={setActiveTab}
        todayKey={todayKey}
        cloud={cloud}
        install={install}
        simOffset={prefs.simOffset}
        onSimulateDay={() => setPrefs((p) => ({ ...p, simOffset: p.simOffset + 1 }))}
        onBackToRealDate={() => setPrefs((p) => ({ ...p, simOffset: 0 }))}
        onExportJSON={exportJSON}
        onExportCSV={() => exportCSV()}
        onImportFile={importFile}
      />

      <main id="contenido" tabIndex={-1} className="flex-1 min-w-0 p-4 pb-[calc(6rem+env(safe-area-inset-bottom))] md:p-8 max-w-6xl mx-auto w-full focus:outline-none">
        <QuickAddBar onSubmit={handleQuickAdd} />

        {activeTab === 'dashboard' && (
          <DashboardView
            data={data}
            todayKey={todayKey}
            name={prefs.name}
            onNavigate={setActiveTab}
            onToggleTask={store.toggleTask}
            onMoveToToday={(ids) => {
              // Guarda las fechas originales para poder deshacer.
              const previous = ids.map((id) => [id, data.tasks.find((t) => t.id === id)?.date]);
              ids.forEach((id) => store.updateTask(id, { date: todayKey }));
              showToast(ids.length === 1 ? '📅 Tarea movida a hoy' : `📅 ${ids.length} tareas movidas a hoy`, {
                label: 'Deshacer',
                onClick: () => previous.forEach(([id, date]) => store.updateTask(id, { date })),
              });
            }}
            onAddWater={() => {
              updateHealth((prev) => ({ ...prev, water: Math.min(prev.water + 1, MAX_WATER) }));
              showToast('💧 +1 vaso de agua');
            }}
          />
        )}
        {activeTab === 'finances' && (
          <FinancesView
            data={data}
            todayKey={todayKey}
            onAddTx={store.addTx}
            onUpdateTx={store.updateTx}
            onDeleteTx={deleteTx}
            onSetBudgets={store.setBudgets}
            onAddRule={store.addRule}
            onRemoveRule={store.removeRule}
            onExportCSV={exportCSV}
            onOpenSettings={() => setActiveTab('settings')}
            showToast={showToast}
          />
        )}
        {activeTab === 'health' && <HealthView health={data.health} updateHealth={updateHealth} showToast={showToast} />}
        {activeTab === 'agenda' && (
          <AgendaView
            tasks={data.tasks}
            todayKey={todayKey}
            onAdd={store.addTask}
            onUpdate={store.updateTask}
            onToggle={store.toggleTask}
            onDelete={deleteTask}
            showToast={showToast}
          />
        )}
        {activeTab === 'settings' && (
          <SettingsView
            prefs={prefs}
            setPrefs={setPrefs}
            settings={data.settings}
            categoryOp={store.categoryOp}
            showToast={showToast}
            onExportJSON={exportJSON}
            onExportCSV={() => exportCSV()}
            onImportFile={importFile}
            onSimulateDay={() => setPrefs((p) => ({ ...p, simOffset: p.simOffset + 1 }))}
            install={install}
            onShowWelcome={() => setShowWelcome(true)}
            onClearAll={clearAll}
          />
        )}
      </main>

      <BottomNav activeTab={activeTab} onTab={setActiveTab} />
    </div>
  );
}
