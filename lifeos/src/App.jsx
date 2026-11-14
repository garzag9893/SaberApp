import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  LayoutDashboard, Wallet, HeartPulse, Calendar, Plus,
  Sparkles, CheckCircle2, Circle, TrendingUp, TrendingDown,
  Droplets, Moon, Activity, Clock, Trash2, Zap, PieChart,
  BarChart3, Download, Upload, Cloud, CloudOff, FileSpreadsheet,
  RotateCcw, History, Pencil, Check, X, Flag, Target, Flame, Smartphone
} from 'lucide-react';
import {
  getTodayKey, addDaysToKey, getShortDayName, formatReadableDate, sortTasksChronologically
} from './lib/dates.js';
import { parseQuickAdd } from './lib/quickAdd.js';
import {
  EXPENSE_CATEGORIES, monthOf, formatMonth, listMonths, filterByMonth, summarize, budgetStatus, sanitizeBudgets
} from './lib/finance.js';
import { rollDay, habitStreak, nextHabitId } from './lib/habits.js';
import {
  CLOUD_ENABLED, loadSession, saveSession, signIn, signUp, signOut,
  freshSession, pullPayload, pushPayload, isAuthError
} from './lib/cloud.js';
import {
  STORAGE_KEYS, defaultTasks, defaultTransactions, defaultHealth,
  sanitizeTasks, sanitizeTransactions, sanitizeHealth, loadStored, saveStored
} from './lib/storage.js';

const MAX_WATER = 15;
const newId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
const money = (n) => n.toLocaleString('es-MX', {
  minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
  maximumFractionDigits: 2
});

const CLOUD_BADGE = {
  synced: { label: 'Nube', title: 'Sincronizado en la nube', Icon: Cloud, cls: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' },
  syncing: { label: 'Subiendo', title: 'Sincronizando con la nube…', Icon: Cloud, cls: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300' },
  error: { label: 'Error', title: 'No se pudo sincronizar; los datos siguen guardados localmente', Icon: CloudOff, cls: 'bg-rose-500/10 border-rose-500/30 text-rose-400' },
  signedout: { label: 'Entrar', title: 'Inicia sesión para sincronizar con la nube', Icon: CloudOff, cls: 'bg-amber-500/10 border-amber-500/30 text-amber-300' },
  local: { label: 'Local', title: 'Guardado localmente', Icon: CloudOff, cls: 'bg-slate-800 border-slate-700 text-slate-400' }
};

export default function LifeOSApp() {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [quickInput, setQuickInput] = useState('');
  const [notification, setNotification] = useState(null);
  const [session, setSession] = useState(() => (CLOUD_ENABLED ? loadSession() : null));
  const [cloudStatus, setCloudStatus] = useState(!CLOUD_ENABLED ? 'local' : session ? 'syncing' : 'signedout');
  const [cloudReady, setCloudReady] = useState(false); // true cuando ya se comparó con la nube
  const [pullNonce, setPullNonce] = useState(0);
  const [showLogin, setShowLogin] = useState(false);
  const [authForm, setAuthForm] = useState({ email: '', password: '' });
  const [authBusy, setAuthBusy] = useState(false);
  const fileInputRef = useRef(null);
  const toastTimerRef = useRef(null);

  // Estados para formulario manual de finanzas
  const [txDesc, setTxDesc] = useState('');
  const [txAmount, setTxAmount] = useState('');
  const [txType, setTxType] = useState('expense');
  const [txCategory, setTxCategory] = useState('Alimentación');

  // --- ESTADO INICIAL CON PERSISTENCIA ---
  const [tasks, setTasks] = useState(() => loadStored(STORAGE_KEYS.tasks, sanitizeTasks, defaultTasks));
  const [transactions, setTransactions] = useState(() => loadStored(STORAGE_KEYS.transactions, sanitizeTransactions, defaultTransactions));
  const [health, setHealth] = useState(() => loadStored(STORAGE_KEYS.health, sanitizeHealth, defaultHealth));
  const [budgets, setBudgets] = useState(() => loadStored(STORAGE_KEYS.budgets, sanitizeBudgets, () => ({})));

  // --- ESTADOS DE FINANZAS ---
  const [financeMonth, setFinanceMonth] = useState(() => monthOf(health.lastActiveDate)); // 'YYYY-MM' | 'all'
  const [editingTxId, setEditingTxId] = useState(null);
  const [editTxForm, setEditTxForm] = useState({ desc: '', amount: '', type: 'expense', category: 'General', date: '' });
  const [editingBudgets, setEditingBudgets] = useState(false);
  const [budgetDraft, setBudgetDraft] = useState({});

  // --- ESTADOS DE HÁBITOS ---
  const [editingHabits, setEditingHabits] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');

  // --- INSTALACIÓN COMO APP (PWA) ---
  const [installPrompt, setInstallPrompt] = useState(null);

  // --- ESTADOS DE AGENDA AVANZADA ---
  const [agendaFilterMode, setAgendaFilterMode] = useState('today'); // 'today' | 'tomorrow' | 'custom' | 'all'
  const [customAgendaDate, setCustomAgendaDate] = useState(() => health.lastActiveDate);
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDate, setNewTaskDate] = useState(() => health.lastActiveDate);
  const [newTaskTime, setNewTaskTime] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState('medium');

  // Estados para edición de tareas
  const [editingTaskId, setEditingTaskId] = useState(null);
  const [editTaskForm, setEditTaskForm] = useState({ title: '', date: '', time: '', priority: 'medium' });

  // --- CONTROL DE VERSIONES PARA LA NUBE (gana el cambio más reciente) ---
  const sessionRef = useRef(session);
  sessionRef.current = session;
  const [initialSnapshot] = useState(() => JSON.stringify({ tasks, transactions, health, budgets }));
  const snapshotRef = useRef(initialSnapshot);
  const updatedAtRef = useRef(null);
  if (updatedAtRef.current === null) {
    try { updatedAtRef.current = localStorage.getItem(STORAGE_KEYS.updatedAt) || ''; } catch { updatedAtRef.current = ''; }
  }
  const lastSyncedRef = useRef(null);   // marca de tiempo de lo último que coincide con la nube
  const skipBumpRef = useRef(false);    // el cambio automático de día no cuenta como edición

  // action opcional: { label, onClick } — p. ej. "Deshacer" tras borrar algo.
  const showToast = useCallback((msg, action = null) => {
    setNotification({ msg, action });
    clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setNotification(null), action ? 7000 : 4000);
  }, []);

  useEffect(() => () => clearTimeout(toastTimerRef.current), []);

  useEffect(() => {
    const onPrompt = (e) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    const onInstalled = () => {
      setInstallPrompt(null);
      showToast('📱 LifeOS se instaló en este dispositivo');
    };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [showToast]);

  const handleInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    try { await installPrompt.userChoice; } catch { /* el usuario cerró el diálogo */ }
    setInstallPrompt(null);
  };

  // --- MOTOR DE CAMBIO DE DÍA Y REINICIO AUTOMÁTICO ---
  // simOffset = días adelantados con "Simular Nuevo Día"; el día esperado es hoy real + simOffset,
  // así la simulación no se revierte en la siguiente verificación ni al recargar.
  const simOffset = health.simOffset || 0;

  useEffect(() => {
    const checkDateRollover = () => {
      const expected = getTodayKey(simOffset);
      if (health.lastActiveDate === expected) return;
      skipBumpRef.current = true;
      setHealth(prev => rollDay(prev, expected));
      setNewTaskDate(expected);
      setCustomAgendaDate(expected);
      showToast(`🌅 ¡Nuevo día (${formatReadableDate(expected)})! Hábitos y agua reiniciados.`);
    };

    checkDateRollover();
    const interval = setInterval(checkDateRollover, 60000);
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') checkDateRollover();
    };

    document.addEventListener('visibilitychange', handleVisibility);
    return () => {
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [health.lastActiveDate, simOffset, showToast]);

  const handleSimulateNextDay = () => {
    setHealth(prev => ({ ...prev, simOffset: (prev.simOffset || 0) + 1 }));
  };

  const handleBackToRealDate = () => {
    setHealth(prev => ({ ...prev, simOffset: 0 }));
  };

  // --- SESIÓN DE NUBE ---
  const updateSession = useCallback((next) => {
    saveSession(next);
    setSession(next);
    if (!next) {
      setCloudReady(false);
      lastSyncedRef.current = null;
      setCloudStatus(CLOUD_ENABLED ? 'signedout' : 'local');
    }
  }, []);

  // Devuelve una sesión con token vigente, renovándolo si hace falta.
  const getSession = useCallback(async (signal) => {
    const current = sessionRef.current;
    if (!current) return null;
    const fresh = await freshSession(current, signal);
    if (fresh !== current) {
      sessionRef.current = fresh;
      updateSession(fresh);
    }
    return fresh;
  }, [updateSession]);

  const handleCloudError = useCallback((err) => {
    if (err?.name === 'AbortError') return;
    if (isAuthError(err)) {
      updateSession(null);
      showToast('🔒 Tu sesión venció. Vuelve a entrar para sincronizar.');
    } else {
      setCloudStatus('error');
    }
  }, [updateSession, showToast]);

  const handleAuth = async (mode) => {
    const email = authForm.email.trim();
    if (!email || authForm.password.length < 6) {
      showToast('⚠️ Escribe tu correo y una contraseña de al menos 6 caracteres');
      return;
    }
    setAuthBusy(true);
    try {
      const next = mode === 'signup' ? await signUp(email, authForm.password) : await signIn(email, authForm.password);
      if (!next) {
        showToast('📧 Cuenta creada. Confirma tu correo y después inicia sesión.');
      } else {
        updateSession(next);
        setCloudStatus('syncing');
        setShowLogin(false);
        setAuthForm({ email: '', password: '' });
        showToast('☁️ Sesión iniciada. Sincronizando…');
      }
    } catch (err) {
      showToast(`❌ ${err.message || 'No se pudo iniciar sesión'}`);
    } finally {
      setAuthBusy(false);
    }
  };

  const handleSignOut = () => {
    const current = sessionRef.current;
    updateSession(null);
    if (current) signOut(current);
    showToast('👋 Sesión cerrada. Tus datos siguen guardados en este dispositivo.');
  };

  // --- DESCARGA DESDE LA NUBE: al entrar, al volver a la pestaña y al recuperar conexión ---
  const userId = session?.userId;
  useEffect(() => {
    if (!CLOUD_ENABLED || !userId) return;
    const controller = new AbortController();

    (async () => {
      try {
        setCloudStatus('syncing');
        const active = await getSession(controller.signal);
        if (!active) return;
        const remote = await pullPayload(active, controller.signal);
        if (controller.signal.aborted) return;

        const remoteStamp = typeof remote?.updatedAt === 'string' ? remote.updatedAt : '';
        if (remote && remoteStamp > updatedAtRef.current) {
          const nextTasks = sanitizeTasks(remote.tasks);
          const nextTransactions = sanitizeTransactions(remote.transactions);
          const nextHealth = sanitizeHealth(remote.health);
          const nextBudgets = sanitizeBudgets(remote.budgets) || {};
          if (nextTasks && nextTransactions && nextHealth) {
            snapshotRef.current = JSON.stringify({ tasks: nextTasks, transactions: nextTransactions, health: nextHealth, budgets: nextBudgets });
            updatedAtRef.current = remoteStamp;
            lastSyncedRef.current = remoteStamp;
            try { localStorage.setItem(STORAGE_KEYS.updatedAt, remoteStamp); } catch { /* sin almacenamiento */ }
            setTasks(nextTasks);
            setTransactions(nextTransactions);
            setHealth(nextHealth);
            setBudgets(nextBudgets);
            setEditingTaskId(null);
            setEditingTxId(null);
            setNewTaskDate(nextHealth.lastActiveDate);
            setCustomAgendaDate(nextHealth.lastActiveDate);
            showToast('☁️ Datos actualizados desde la nube');
          }
        } else if (remote && remoteStamp === updatedAtRef.current) {
          lastSyncedRef.current = remoteStamp;
        }
        setCloudReady(true);
        setCloudStatus('synced');
      } catch (err) {
        handleCloudError(err);
      }
    })();

    return () => controller.abort();
  }, [userId, pullNonce, getSession, handleCloudError, showToast]);

  useEffect(() => {
    if (!CLOUD_ENABLED) return;
    const retry = () => {
      if (document.visibilityState === 'visible') setPullNonce(n => n + 1);
    };
    document.addEventListener('visibilitychange', retry);
    window.addEventListener('online', retry);
    return () => {
      document.removeEventListener('visibilitychange', retry);
      window.removeEventListener('online', retry);
    };
  }, []);

  // --- GUARDADO LOCAL Y SUBIDA A LA NUBE ---
  useEffect(() => {
    const snapshot = JSON.stringify({ tasks, transactions, health, budgets });
    if (snapshot !== snapshotRef.current) {
      snapshotRef.current = snapshot;
      if (skipBumpRef.current) skipBumpRef.current = false;
      else updatedAtRef.current = new Date().toISOString();
    }

    const saved = [
      saveStored(STORAGE_KEYS.tasks, tasks),
      saveStored(STORAGE_KEYS.transactions, transactions),
      saveStored(STORAGE_KEYS.health, health),
      saveStored(STORAGE_KEYS.budgets, budgets)
    ].every(Boolean);
    try { localStorage.setItem(STORAGE_KEYS.updatedAt, updatedAtRef.current); } catch { /* sin almacenamiento */ }
    if (!saved) showToast('⚠️ No se pudo guardar en este navegador (almacenamiento lleno o bloqueado)');

    // No se sube nada hasta haber comparado con la nube, para no pisar datos más recientes.
    if (!CLOUD_ENABLED || !userId || !cloudReady) return;
    if (lastSyncedRef.current === updatedAtRef.current) return;

    setCloudStatus('syncing');
    const controller = new AbortController();
    const timeout = setTimeout(async () => {
      try {
        const active = await getSession(controller.signal);
        if (!active) return;
        const stamp = updatedAtRef.current;
        await pushPayload(active, { tasks, transactions, health, budgets, updatedAt: stamp }, controller.signal);
        lastSyncedRef.current = stamp;
        setCloudStatus('synced');
      } catch (err) {
        handleCloudError(err);
      }
    }, 1000);

    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [tasks, transactions, health, budgets, userId, cloudReady, getSession, handleCloudError, showToast]);

  // --- EXPORTAR E IMPORTAR RESPALDOS ---
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

  const handleExportJSON = () => {
    const backup = { version: '5.1', exportedAt: new Date().toISOString(), tasks, transactions, health, budgets };
    downloadBlob(
      new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' }),
      `LifeOS_Respaldo_${health.lastActiveDate}.json`
    );
    showToast('📦 Respaldo completo (.JSON) descargado');
  };

  const handleExportCSV = (list = transactions, label = health.lastActiveDate) => {
    // Comillas en todo texto; el apóstrofo inicial evita que Excel ejecute fórmulas (=, +, -, @).
    const cell = (value) => {
      let s = String(value ?? '');
      if (/^[=+\-@]/.test(s)) s = `'${s}`;
      return `"${s.replace(/"/g, '""')}"`;
    };
    const rows = list.map(t => [
      cell(t.id), cell(t.desc), t.amount, t.type === 'income' ? 'Ingreso' : 'Gasto', cell(t.category), t.date
    ].join(','));
    const csv = ['ID,Descripcion,Monto,Tipo,Categoria,Fecha', ...rows].join('\r\n');
    // El BOM (\uFEFF) hace que Excel lea los acentos como UTF-8.
    downloadBlob(
      new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' }),
      `LifeOS_Finanzas_${label}.csv`
    );
    showToast('📊 Reporte financiero (.CSV) exportado');
  };

  const handleImportJSON = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target.result);
        const nextTasks = sanitizeTasks(parsed?.tasks);
        const nextTransactions = sanitizeTransactions(parsed?.transactions);
        const nextHealth = sanitizeHealth(parsed?.health);
        const nextBudgets = sanitizeBudgets(parsed?.budgets);
        if (!nextTasks && !nextTransactions && !nextHealth) throw new Error('Respaldo sin datos reconocibles');

        if (nextBudgets) setBudgets(nextBudgets);
        if (nextTasks) setTasks(nextTasks);
        if (nextTransactions) setTransactions(nextTransactions);
        if (nextHealth) {
          setHealth(nextHealth);
          setNewTaskDate(nextHealth.lastActiveDate);
          setCustomAgendaDate(nextHealth.lastActiveDate);
        }
        setEditingTaskId(null);
        setEditingTxId(null);
        showToast('✅ Datos restaurados exitosamente');
      } catch (err) {
        showToast('❌ Error: Archivo de respaldo inválido');
      }
    };
    reader.onerror = () => showToast('❌ Error: No se pudo leer el archivo');
    reader.readAsText(file);
    e.target.value = '';
  };

  // --- PROCESADOR INTELIGENTE (QUICK-ADD) ---
  const handleQuickAdd = (e) => {
    e.preventDefault();
    if (!quickInput.trim()) return;

    const parsed = parseQuickAdd(quickInput, health.lastActiveDate);

    if (parsed.kind === 'transaction') {
      if (!(parsed.amount > 0)) {
        showToast('⚠️ El monto debe ser mayor a $0');
        return;
      }
      setTransactions(prev => [{
        id: newId(),
        desc: parsed.desc,
        amount: parsed.amount,
        type: parsed.type,
        category: parsed.category,
        date: health.lastActiveDate
      }, ...prev]);
      showToast(`💰 ${parsed.type === 'income' ? 'Ingreso' : 'Gasto'} de $${money(parsed.amount)} (${parsed.category}) registrado`);
    } else if (parsed.kind === 'water') {
      setHealth(prev => ({ ...prev, water: Math.min(prev.water + parsed.glasses, MAX_WATER) }));
      showToast(`💧 +${parsed.glasses} ${parsed.glasses === 1 ? 'vaso' : 'vasos'} de agua registrado hoy`);
    } else {
      setTasks(prev => [{
        id: newId(),
        title: parsed.title,
        date: parsed.date,
        time: parsed.time,
        priority: 'medium',
        completed: false
      }, ...prev]);
      const dayLabel =
        parsed.date === health.lastActiveDate ? 'hoy' :
        parsed.date === addDaysToKey(health.lastActiveDate, 1) ? 'mañana' :
        formatReadableDate(parsed.date);
      showToast(`📅 Agendado para ${dayLabel}${parsed.time ? ` a las ${parsed.time}` : ''}`);
    }
    setQuickInput('');
  };

  // --- BORRADO CON "DESHACER" ---
  // Reinserta el elemento en su posición original si aún no existe.
  const reinsert = (list, item, index) =>
    list.some(x => x.id === item.id) ? list : [...list.slice(0, index), item, ...list.slice(index)];

  const deleteTask = (id) => {
    const index = tasks.findIndex(t => t.id === id);
    if (index < 0) return;
    const removed = tasks[index];
    setTasks(prev => prev.filter(t => t.id !== id));
    if (editingTaskId === id) setEditingTaskId(null);
    showToast(`🗑️ Tarea eliminada: ${removed.title}`, {
      label: 'Deshacer',
      onClick: () => setTasks(prev => reinsert(prev, removed, index))
    });
  };

  const deleteTransaction = (id) => {
    const index = transactions.findIndex(t => t.id === id);
    if (index < 0) return;
    const removed = transactions[index];
    setTransactions(prev => prev.filter(t => t.id !== id));
    if (editingTxId === id) setEditingTxId(null);
    showToast(`🗑️ Movimiento eliminado: ${removed.desc}`, {
      label: 'Deshacer',
      onClick: () => setTransactions(prev => reinsert(prev, removed, index))
    });
  };

  // --- EDICIÓN DE MOVIMIENTOS ---
  const startEditingTx = (tx) => {
    setEditingTxId(tx.id);
    setEditTxForm({ desc: tx.desc, amount: String(tx.amount), type: tx.type, category: tx.category, date: tx.date });
  };

  const saveEditedTx = (id) => {
    const amount = parseFloat(editTxForm.amount);
    if (!editTxForm.desc.trim()) {
      showToast('⚠️ El movimiento necesita un concepto');
      return;
    }
    if (!(amount > 0)) {
      showToast('⚠️ El monto debe ser mayor a $0');
      return;
    }
    setTransactions(prev => prev.map(t => t.id === id ? {
      ...t,
      desc: editTxForm.desc.trim(),
      amount,
      type: editTxForm.type,
      category: editTxForm.type === 'income' ? 'Salario' : (editTxForm.category === 'Salario' ? 'General' : editTxForm.category),
      date: editTxForm.date || t.date
    } : t));
    setEditingTxId(null);
    showToast('✅ Movimiento actualizado');
  };

  // --- PRESUPUESTOS ---
  const startEditingBudgets = () => {
    setBudgetDraft(Object.fromEntries(EXPENSE_CATEGORIES.map(c => [c, budgets[c] ? String(budgets[c]) : ''])));
    setEditingBudgets(true);
  };

  const saveBudgets = (e) => {
    e.preventDefault();
    const extra = Object.fromEntries(Object.entries(budgets).filter(([c]) => !EXPENSE_CATEGORIES.includes(c)));
    setBudgets({ ...extra, ...(sanitizeBudgets(budgetDraft) || {}) });
    setEditingBudgets(false);
    showToast('🎯 Presupuestos guardados');
  };

  // --- HÁBITOS EDITABLES ---
  const toggleHabit = (id) => setHealth(prev => ({
    ...prev,
    habits: prev.habits.map(h => h.id === id ? { ...h, done: !h.done } : h)
  }));

  const renameHabit = (id, name) => setHealth(prev => ({
    ...prev,
    habits: prev.habits.map(h => h.id === id ? { ...h, name } : h)
  }));

  const addHabit = (e) => {
    e.preventDefault();
    const name = newHabitName.trim();
    if (!name) return;
    setHealth(prev => ({ ...prev, habits: [...prev.habits, { id: nextHabitId(prev.habits), name, done: false }] }));
    setNewHabitName('');
  };

  const deleteHabit = (id) => {
    const index = health.habits.findIndex(h => h.id === id);
    if (index < 0) return;
    const removed = health.habits[index];
    setHealth(prev => ({ ...prev, habits: prev.habits.filter(h => h.id !== id) }));
    showToast(`🗑️ Hábito eliminado: ${removed.name || 'sin nombre'}`, {
      label: 'Deshacer',
      onClick: () => setHealth(prev => ({ ...prev, habits: reinsert(prev.habits, removed, index) }))
    });
  };

  const finishEditingHabits = () => {
    // Los hábitos que quedaron sin nombre se descartan.
    setHealth(prev => ({
      ...prev,
      habits: prev.habits.map(h => ({ ...h, name: h.name.trim() })).filter(h => h.name)
    }));
    setEditingHabits(false);
  };

  // --- FUNCIONES DE AGENDA AVANZADA ---
  const toggleTask = (id) => setTasks(prev => prev.map(t => t.id === id ? { ...t, completed: !t.completed } : t));

  const handleAddTaskManual = (e) => {
    e.preventDefault();
    if (!newTaskTitle.trim()) return;
    setTasks(prev => [{
      id: newId(),
      title: newTaskTitle.trim(),
      date: newTaskDate || health.lastActiveDate,
      time: newTaskTime || '',
      priority: newTaskPriority,
      completed: false
    }, ...prev]);
    setNewTaskTitle('');
    setNewTaskTime('');
    showToast('📅 Tarea agregada y ordenada cronológicamente');
  };

  const startEditingTask = (task) => {
    setEditingTaskId(task.id);
    setEditTaskForm({
      title: task.title,
      date: task.date || health.lastActiveDate,
      time: task.time === 'Sin hora' ? '' : (task.time || ''),
      priority: task.priority || 'medium'
    });
  };

  const saveEditedTask = (id) => {
    if (!editTaskForm.title.trim()) {
      showToast('⚠️ La tarea necesita un título');
      return;
    }
    setTasks(prev => prev.map(t => t.id === id ? {
      ...t,
      title: editTaskForm.title.trim(),
      date: editTaskForm.date || health.lastActiveDate,
      time: editTaskForm.time,
      priority: editTaskForm.priority
    } : t));
    setEditingTaskId(null);
    showToast('✅ Tarea actualizada');
  };

  const todayKey = health.lastActiveDate;
  const tomorrowKey = addDaysToKey(todayKey, 1);

  const selectedAgendaDate =
    agendaFilterMode === 'today' ? todayKey :
    agendaFilterMode === 'tomorrow' ? tomorrowKey :
    agendaFilterMode === 'custom' ? customAgendaDate : null;

  // Las tareas pendientes de días anteriores siguen apareciendo en "Hoy" hasta completarse o moverse.
  const isOverdue = (t) => !t.completed && Boolean(t.date) && t.date < todayKey;
  const isForToday = (t) => (t.date || todayKey) === todayKey || isOverdue(t);

  const filteredAndSortedTasks = sortTasksChronologically(
    tasks.filter(t =>
      agendaFilterMode === 'all' ||
      (agendaFilterMode === 'today' ? isForToday(t) : (t.date || todayKey) === selectedAgendaDate)
    ),
    todayKey
  );

  const todayTasksSorted = sortTasksChronologically(tasks.filter(isForToday), todayKey);
  const overdueCount = tasks.filter(isOverdue).length;

  const moveTaskToToday = (id) => {
    setTasks(prev => prev.map(t => t.id === id ? { ...t, date: todayKey } : t));
    showToast('📅 Tarea movida a hoy');
  };

  const handleManualTx = (e) => {
    e.preventDefault();
    const amount = parseFloat(txAmount);
    if (!txDesc.trim()) return;
    if (!(amount > 0)) {
      showToast('⚠️ El monto debe ser mayor a $0');
      return;
    }
    setTransactions(prev => [{
      id: newId(),
      desc: txDesc.trim(),
      amount,
      type: txType,
      category: txType === 'income' ? 'Salario' : txCategory,
      date: health.lastActiveDate
    }, ...prev]);
    setTxDesc('');
    setTxAmount('');
    showToast('✅ Movimiento guardado correctamente');
  };

  // --- CONSTRUCCIÓN DE SERIE SEMANAL DINÁMICA ---
  const recentSixLogs = [...(health.dailyLogs || [])]
    .slice(0, 6)
    .reverse()
    .map(log => ({
      day: getShortDayName(log.date),
      sleep: log.sleep,
      mood: log.mood,
      isToday: false
    }));

  const weeklyChartData = [
    ...recentSixLogs,
    { day: 'Hoy', sleep: health.sleepHours, mood: health.mood, isToday: true }
  ];

  // --- CÁLCULOS DINÁMICOS ---
  const totalIncome = transactions.filter(t => t.type === 'income').reduce((acc, curr) => acc + curr.amount, 0);
  const totalExpense = transactions.filter(t => t.type === 'expense').reduce((acc, curr) => acc + curr.amount, 0);
  const balance = totalIncome - totalExpense;
  const completedTodayTasks = todayTasksSorted.filter(t => t.completed).length;
  const completedHabits = health.habits.filter(h => h.done).length;

  const categoryColors = {
    'Alimentación': '#10b981',
    'Transporte': '#6366f1',
    'Salud': '#f43f5e',
    'Ocio': '#f59e0b',
    'General': '#8b5cf6',
  };

  // Finanzas por periodo (mes seleccionado o todo el historial)
  const currentMonth = monthOf(todayKey);
  const financeMonths = [...new Set([
    ...listMonths(transactions, currentMonth),
    ...(financeMonth === 'all' ? [] : [financeMonth])
  ])].sort((a, b) => b.localeCompare(a));
  const periodTransactions = [...filterByMonth(transactions, financeMonth)]
    .sort((a, b) => b.date.localeCompare(a.date));
  const periodSummary = summarize(periodTransactions);
  const periodLabel = financeMonth === 'all' ? 'Todo el historial' : formatMonth(financeMonth);
  const currentMonthSummary = summarize(filterByMonth(transactions, currentMonth));

  // Los presupuestos son mensuales: con "Todo el historial" se muestran los del mes actual.
  const budgetMonth = financeMonth === 'all' ? currentMonth : financeMonth;
  const budgetSummary = budgetMonth === currentMonth ? currentMonthSummary : summarize(filterByMonth(transactions, budgetMonth));
  const budgetRows = EXPENSE_CATEGORIES
    .map(cat => ({ cat, status: budgetStatus(budgetSummary.byCategory[cat] || 0, budgets[cat]) }))
    .filter(row => row.status);
  const overBudget = EXPENSE_CATEGORIES.filter(cat =>
    budgetStatus(currentMonthSummary.byCategory[cat] || 0, budgets[cat])?.level === 'over'
  );

  const categoryData = Object.entries(periodSummary.byCategory)
    .map(([name, value]) => ({
      name,
      value,
      percentage: periodSummary.expense > 0 ? (value / periodSummary.expense) * 100 : 0,
      color: categoryColors[name] || '#64748b'
    }))
    .sort((a, b) => b.value - a.value);

  let cumulativePercent = 0;
  const donutSegments = categoryData.map(cat => {
    const startPercent = cumulativePercent;
    cumulativePercent += cat.percentage;
    return { ...cat, startPercent };
  });

  const priorityBadge = {
    high: { label: 'Alta', cls: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
    medium: { label: 'Media', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
    low: { label: 'Baja', cls: 'bg-slate-700/50 text-slate-400 border-slate-600/40' }
  };

  const getDailyInsight = () => {
    if (health.sleepHours < 6.5) return "Dormiste menos de 6.5h. Prioriza tus 2 tareas más importantes y evita compras impulsivas hoy.";
    if (overBudget.length) return `Ya superaste tu presupuesto de ${overBudget.join(', ')} este mes. Revisa tus gastos en Finanzas antes de seguir comprando.`;
    if (balance < 1000) return "Tu balance disponible está ajustado. Mantén tus gastos variables al mínimo esta semana.";
    if (completedHabits >= 3) return "¡Excelente racha de hábitos hoy! Tu nivel de energía es óptimo para avanzar en tus metas.";
    const pending = todayTasksSorted.length - completedTodayTasks;
    return `Hoy es ${formatReadableDate(health.lastActiveDate)}. Tienes ${pending} ${pending === 1 ? 'tarea pendiente' : 'tareas pendientes'} hoy${overdueCount ? ` (${overdueCount} ${overdueCount === 1 ? 'atrasada' : 'atrasadas'})` : ''}.`;
  };

  const cloudBadge = CLOUD_BADGE[cloudStatus] || CLOUD_BADGE.local;
  const CloudIcon = cloudBadge.Icon;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans flex flex-col md:flex-row">

      {/* Notificación Flotante */}
      {notification && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-4 right-4 md:left-auto md:right-6 z-50 bg-indigo-600 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2"
        >
          <Sparkles className="w-4 h-4 shrink-0" />
          <span className="text-sm font-medium flex-1">{notification.msg}</span>
          {notification.action && (
            <button
              type="button"
              onClick={() => {
                notification.action.onClick();
                setNotification(null);
              }}
              className="shrink-0 text-xs font-bold uppercase tracking-wide bg-white/15 hover:bg-white/25 px-2.5 py-1 rounded-lg"
            >
              {notification.action.label}
            </button>
          )}
        </div>
      )}

      {/* SIDEBAR / NAVEGACIÓN */}
      <aside className="w-full md:w-64 md:shrink-0 bg-slate-900 border-b md:border-b-0 md:border-r border-slate-800 p-4 flex flex-col justify-between">
        <div>
          <div className="flex items-center justify-between px-2 mb-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-indigo-500 to-emerald-400 flex items-center justify-center font-bold text-slate-950">
                OS
              </div>
              <div>
                <h1 className="font-bold text-lg tracking-tight">LifeOS</h1>
                <p className="text-xs text-indigo-400 font-medium">{formatReadableDate(health.lastActiveDate)}</p>
              </div>
            </div>

            {cloudStatus === 'signedout' || cloudStatus === 'error' ? (
              <button
                type="button"
                title={cloudBadge.title}
                onClick={() => (cloudStatus === 'error' ? setPullNonce(n => n + 1) : setShowLogin(v => !v))}
                aria-expanded={cloudStatus === 'signedout' ? showLogin : undefined}
                className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border ${cloudBadge.cls}`}
              >
                <CloudIcon className="w-3 h-3" />
                <span>{cloudStatus === 'error' ? 'Reintentar' : cloudBadge.label}</span>
              </button>
            ) : (
              <div
                title={cloudBadge.title}
                className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded-full border ${cloudBadge.cls}`}
              >
                <CloudIcon className="w-3 h-3" />
                <span>{cloudBadge.label}</span>
              </div>
            )}
          </div>

          {CLOUD_ENABLED && !session && showLogin && (
            <form
              onSubmit={(e) => { e.preventDefault(); handleAuth('signin'); }}
              className="mb-4 p-3 rounded-xl bg-slate-800/60 border border-slate-700 space-y-2"
            >
              <p className="text-[11px] text-slate-400">Entra para respaldar y sincronizar tus datos entre dispositivos.</p>
              <input
                type="email"
                autoComplete="email"
                placeholder="Correo"
                aria-label="Correo"
                value={authForm.email}
                onChange={(e) => setAuthForm({ ...authForm, email: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
              />
              <input
                type="password"
                autoComplete="current-password"
                placeholder="Contraseña"
                aria-label="Contraseña"
                value={authForm.password}
                onChange={(e) => setAuthForm({ ...authForm, password: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-indigo-500"
              />
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="submit"
                  disabled={authBusy}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold py-1.5 rounded-lg"
                >
                  Entrar
                </button>
                <button
                  type="button"
                  disabled={authBusy}
                  onClick={() => handleAuth('signup')}
                  className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 text-xs py-1.5 rounded-lg"
                >
                  Crear cuenta
                </button>
              </div>
            </form>
          )}

          <nav className="flex md:flex-col gap-1 overflow-x-auto">
            {[
              { id: 'dashboard', label: 'Hoy (Resumen)', icon: LayoutDashboard },
              { id: 'finances', label: 'Finanzas', icon: Wallet },
              { id: 'health', label: 'Salud y Hábitos', icon: HeartPulse },
              { id: 'agenda', label: 'Agenda', icon: Calendar },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  aria-current={activeTab === item.id ? 'page' : undefined}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium border transition-all whitespace-nowrap ${
                    activeTab === item.id
                      ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30'
                      : 'border-transparent text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {item.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* CONTROLES DE CICLO DIARIO Y RESPALDOS */}
        <div className="mt-6 pt-4 border-t border-slate-800 space-y-2.5">
          {installPrompt && (
            <button
              onClick={handleInstall}
              className="w-full flex items-center justify-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-medium py-2 px-3 rounded-lg border border-emerald-500/30 transition-colors"
            >
              <Smartphone className="w-3.5 h-3.5" /> Instalar como app
            </button>
          )}
          <button
            onClick={handleSimulateNextDay}
            className="w-full flex items-center justify-center gap-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-xs font-medium py-2 px-3 rounded-lg border border-indigo-500/30 transition-colors"
            title="Archiva los datos de hoy en el historial y reinicia hábitos y agua para mañana"
          >
            <RotateCcw className="w-3.5 h-3.5" /> Simular Nuevo Día
          </button>
          {simOffset > 0 && (
            <button
              onClick={handleBackToRealDate}
              className="w-full text-[11px] text-amber-300 hover:text-amber-200 py-1"
              title="Archiva el día simulado y regresa a la fecha real"
            >
              Simulación: +{simOffset} {simOffset === 1 ? 'día' : 'días'} · Volver a la fecha real
            </button>
          )}

          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 px-2 pt-1">Datos y Respaldo</p>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              onClick={handleExportJSON}
              className="flex items-center justify-center gap-1.5 bg-slate-800/70 hover:bg-slate-800 text-slate-300 text-xs py-2 px-2 rounded-lg border border-slate-700/60 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-indigo-400" /> JSON
            </button>
            <button
              onClick={() => handleExportCSV()}
              title="Exporta todos los movimientos"
              className="flex items-center justify-center gap-1.5 bg-slate-800/70 hover:bg-slate-800 text-slate-300 text-xs py-2 px-2 rounded-lg border border-slate-700/60 transition-colors"
            >
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" /> Excel
            </button>
          </div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="w-full flex items-center justify-center gap-1.5 bg-slate-800/40 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs py-2 px-3 rounded-lg border border-dashed border-slate-700 transition-colors"
          >
            <Upload className="w-3.5 h-3.5" /> Restaurar Respaldo
          </button>
          <input type="file" accept=".json,application/json" ref={fileInputRef} onChange={handleImportJSON} className="hidden" />

          {session && (
            <div className="flex items-center justify-between gap-2 px-1 pt-1 text-[11px] text-slate-500">
              <span className="truncate" title={session.email}>{session.email}</span>
              <button onClick={handleSignOut} className="shrink-0 text-slate-400 hover:text-slate-200 underline">
                Cerrar sesión
              </button>
            </div>
          )}
        </div>
      </aside>

      {/* ÁREA PRINCIPAL */}
      <main className="flex-1 min-w-0 p-4 md:p-8 max-w-6xl mx-auto w-full">

        {/* BARRA INTELIGENTE QUICK-ADD */}
        <form onSubmit={handleQuickAdd} className="mb-8">
          <div className="relative flex items-center">
            <Sparkles className="w-5 h-5 text-indigo-400 absolute left-4" />
            <input
              type="text"
              value={quickInput}
              onChange={(e) => setQuickInput(e.target.value)}
              aria-label="Entrada rápida"
              placeholder="Entrada rápida: 'Comida $180', 'Dentista mañana 16:00', 'Tomar agua'..."
              className="w-full bg-slate-900 border border-slate-700/80 focus:border-indigo-500 rounded-2xl py-3.5 pl-12 pr-28 text-sm text-slate-100 placeholder-slate-500 focus:outline-none shadow-lg"
            />
            <button
              type="submit"
              className="absolute right-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold px-4 py-2 rounded-xl transition-colors flex items-center gap-1"
            >
              <Plus className="w-4 h-4" /> Añadir
            </button>
          </div>
        </form>

        {/* ================= VISTA 1: DASHBOARD ================= */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="bg-gradient-to-r from-indigo-950/80 to-slate-900 border border-indigo-500/30 p-4 rounded-2xl flex items-start gap-3">
              <Zap className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <h3 className="text-xs font-semibold uppercase tracking-wider text-indigo-300">Análisis Inteligente del Día</h3>
                <p className="text-sm text-slate-200 mt-0.5">{getDailyInsight()}</p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <button type="button" onClick={() => setActiveTab('finances')} className="text-left cursor-pointer bg-slate-900 border border-slate-800 hover:border-slate-700 p-5 rounded-2xl transition-all">
                <div className="flex justify-between items-center text-slate-400 text-xs font-medium mb-2">
                  <span>BALANCE DISPONIBLE</span>
                  <Wallet className="w-4 h-4 text-emerald-400" />
                </div>
                <div className="text-2xl font-bold text-white">${money(balance)}</div>
                <div className="text-xs text-slate-400 mt-2 flex flex-wrap gap-x-3 gap-y-1">
                  <span className="text-emerald-400">+${money(totalIncome)}</span>
                  <span className="text-rose-400">-${money(totalExpense)}</span>
                  <span>· Gastos del mes: ${money(currentMonthSummary.expense)}</span>
                </div>
                {overBudget.length > 0 && (
                  <p className="text-[11px] text-rose-300 mt-1.5">Presupuesto excedido: {overBudget.join(', ')}</p>
                )}
              </button>

              <button type="button" onClick={() => setActiveTab('health')} className="text-left cursor-pointer bg-slate-900 border border-slate-800 hover:border-slate-700 p-5 rounded-2xl transition-all">
                <div className="flex justify-between items-center text-slate-400 text-xs font-medium mb-2">
                  <span>SALUD Y HÁBITOS (HOY)</span>
                  <HeartPulse className="w-4 h-4 text-rose-400" />
                </div>
                <div className="text-2xl font-bold text-white">{completedHabits}/{health.habits.length} <span className="text-sm font-normal text-slate-400">hábitos</span></div>
                <div className="text-xs text-slate-400 mt-2 flex gap-3">
                  <span>💧 {health.water}/{health.waterGoal} vasos</span>
                  <span>🌙 {health.sleepHours}h sueño</span>
                </div>
              </button>

              <button type="button" onClick={() => setActiveTab('agenda')} className="text-left cursor-pointer bg-slate-900 border border-slate-800 hover:border-slate-700 p-5 rounded-2xl transition-all">
                <div className="flex justify-between items-center text-slate-400 text-xs font-medium mb-2">
                  <span>AGENDA DE HOY</span>
                  <Calendar className="w-4 h-4 text-indigo-400" />
                </div>
                <div className="text-2xl font-bold text-white">{completedTodayTasks}/{todayTasksSorted.length} <span className="text-sm font-normal text-slate-400">tareas</span></div>
                <div className="w-full bg-slate-800 h-1.5 rounded-full mt-3 overflow-hidden">
                  <div
                    className="bg-indigo-500 h-full transition-all"
                    style={{ width: `${todayTasksSorted.length ? (completedTodayTasks / todayTasksSorted.length) * 100 : 0}%` }}
                  />
                </div>
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-sm text-slate-200 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-indigo-400" /> Enfoque de Hoy (Ordenado)
                  </h3>
                  <button onClick={() => setActiveTab('agenda')} className="text-xs text-indigo-400 hover:underline">Ver todo</button>
                </div>
                {todayTasksSorted.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center">No hay tareas programadas para hoy.</p>
                ) : (
                  <div className="space-y-2.5">
                    {todayTasksSorted.slice(0, 4).map(task => (
                      <button
                        type="button"
                        key={task.id}
                        onClick={() => toggleTask(task.id)}
                        aria-pressed={task.completed}
                        className="w-full text-left flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-800/40 hover:bg-slate-800 cursor-pointer"
                      >
                        <div className="flex items-center gap-3 min-w-0">
                          {task.completed ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" /> : <Circle className="w-4 h-4 text-slate-500 shrink-0" />}
                          <span className={`text-sm break-words min-w-0 ${task.completed ? 'line-through text-slate-500' : 'text-slate-200'}`}>{task.title}</span>
                        </div>
                        {isOverdue(task) ? (
                          <span className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/30 px-2 py-1 rounded-md shrink-0">
                            Atrasada
                          </span>
                        ) : (
                          <span className="text-xs text-slate-400 bg-slate-900 px-2 py-1 rounded-md shrink-0">
                            {task.time || 'Sin hora'}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <h3 className="font-semibold text-sm text-slate-200 mb-4 flex items-center gap-2">
                  <Wallet className="w-4 h-4 text-emerald-400" /> Últimos Movimientos
                </h3>
                {transactions.length === 0 ? (
                  <p className="text-xs text-slate-500 py-6 text-center">Aún no hay movimientos registrados.</p>
                ) : (
                  <div className="space-y-2.5">
                    {transactions.slice(0, 4).map(tr => (
                      <div key={tr.id} className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-slate-800/40">
                        <div className="min-w-0">
                          <p className="text-sm text-slate-200 break-words">{tr.desc}</p>
                          <p className="text-xs text-slate-500">{tr.category} • {tr.date}</p>
                        </div>
                        <span className={`text-sm font-semibold shrink-0 ${tr.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {tr.type === 'income' ? '+' : '-'}${money(tr.amount)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ================= VISTA 2: FINANZAS ================= */}
        {activeTab === 'finances' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold">Finanzas</h2>
                <p className="text-xs text-slate-400">{periodLabel}</p>
              </div>
              <label className="flex items-center gap-2 text-xs text-slate-400">
                Periodo
                <select
                  value={financeMonth}
                  onChange={(e) => {
                    setFinanceMonth(e.target.value);
                    setEditingTxId(null);
                    setEditingBudgets(false);
                  }}
                  className="bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                >
                  {financeMonths.map(m => (
                    <option key={m} value={m}>{formatMonth(m)}{m === currentMonth ? ' (actual)' : ''}</option>
                  ))}
                  <option value="all">Todo el historial</option>
                </select>
              </label>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <span className="text-xs text-slate-400">INGRESOS</span>
                <p className="text-2xl font-bold text-emerald-400 mt-1">+${money(periodSummary.income)}</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <span className="text-xs text-slate-400">GASTOS</span>
                <p className="text-2xl font-bold text-rose-400 mt-1">-${money(periodSummary.expense)}</p>
              </div>
              <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
                <span className="text-xs text-slate-400">{financeMonth === 'all' ? 'BALANCE NETO' : 'AHORRO DEL PERIODO'}</span>
                <p className={`text-2xl font-bold mt-1 ${periodSummary.balance < 0 ? 'text-rose-400' : 'text-white'}`}>
                  {periodSummary.balance < 0 ? '-' : ''}${money(Math.abs(periodSummary.balance))}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                <h3 className="font-semibold text-base mb-4 flex items-center gap-2">
                  <PieChart className="w-4 h-4 text-indigo-400" /> Distribución de Gastos
                </h3>
                {categoryData.length === 0 ? (
                  <p className="text-sm text-slate-500 py-10 text-center">No hay gastos en este periodo.</p>
                ) : (
                  <div className="flex flex-col sm:flex-row items-center gap-6">
                    <div className="relative w-40 h-40 shrink-0">
                      <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90" role="img" aria-label="Gráfica de distribución de gastos por categoría">
                        {donutSegments.map((seg) => (
                          <circle
                            key={seg.name}
                            cx="18" cy="18" r="15.915"
                            fill="transparent"
                            stroke={seg.color}
                            strokeWidth="3.8"
                            strokeDasharray={`${seg.percentage} ${100 - seg.percentage}`}
                            strokeDashoffset={-seg.startPercent}
                            className="transition-all duration-500"
                          />
                        ))}
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                        <span className="text-[10px] text-slate-400 uppercase">Total Gasto</span>
                        <span className="text-sm font-bold text-white">${money(periodSummary.expense)}</span>
                      </div>
                    </div>

                    <div className="flex-1 w-full space-y-2.5">
                      {categoryData.map((cat) => (
                        <div key={cat.name} className="space-y-1">
                          <div className="flex justify-between text-xs">
                            <span className="flex items-center gap-2 text-slate-300">
                              <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: cat.color }} />
                              {cat.name}
                            </span>
                            <span className="font-medium text-slate-200">
                              ${money(cat.value)} ({cat.percentage.toFixed(0)}%)
                            </span>
                          </div>
                          <div className="w-full bg-slate-800 h-1.5 rounded-full overflow-hidden">
                            <div
                              className="h-full rounded-full transition-all duration-500"
                              style={{ width: `${cat.percentage}%`, backgroundColor: cat.color }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                <h3 className="font-semibold text-base mb-4">Registrar Movimiento</h3>
                <form onSubmit={handleManualTx} className="space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setTxType('expense')}
                      aria-pressed={txType === 'expense'}
                      className={`py-2 rounded-xl text-xs font-semibold border ${txType === 'expense' ? 'bg-rose-500/20 border-rose-500 text-rose-300' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                    >
                      Gasto (-)
                    </button>
                    <button
                      type="button"
                      onClick={() => setTxType('income')}
                      aria-pressed={txType === 'income'}
                      className={`py-2 rounded-xl text-xs font-semibold border ${txType === 'income' ? 'bg-emerald-500/20 border-emerald-500 text-emerald-300' : 'bg-slate-800 border-slate-700 text-slate-400'}`}
                    >
                      Ingreso (+)
                    </button>
                  </div>

                  <input
                    type="text"
                    placeholder="Concepto (ej. Pago de luz)"
                    aria-label="Concepto"
                    value={txDesc}
                    onChange={(e) => setTxDesc(e.target.value)}
                    className="w-full bg-slate-800/70 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      inputMode="decimal"
                      placeholder="Monto ($)"
                      aria-label="Monto"
                      value={txAmount}
                      onChange={(e) => setTxAmount(e.target.value)}
                      className="w-full bg-slate-800/70 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                    />
                    {txType === 'expense' && (
                      <select
                        value={txCategory}
                        aria-label="Categoría"
                        onChange={(e) => setTxCategory(e.target.value)}
                        className="w-full bg-slate-800/70 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                      >
                        {EXPENSE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                      </select>
                    )}
                  </div>

                  <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-semibold py-2.5 rounded-xl text-sm transition-colors">
                    Guardar Transacción
                  </button>
                </form>
              </div>
            </div>

            {/* Presupuestos mensuales por categoría */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
              <div className="flex justify-between items-center gap-3 mb-4">
                <div>
                  <h3 className="font-semibold text-base flex items-center gap-2">
                    <Target className="w-4 h-4 text-amber-400" /> Presupuestos
                  </h3>
                  <p className="text-xs text-slate-400">Límite mensual por categoría · {formatMonth(budgetMonth)}</p>
                </div>
                {!editingBudgets && (
                  <button onClick={startEditingBudgets} className="text-xs text-indigo-400 hover:underline flex items-center gap-1">
                    <Pencil className="w-3.5 h-3.5" /> {budgetRows.length ? 'Editar' : 'Definir'}
                  </button>
                )}
              </div>

              {editingBudgets ? (
                <form onSubmit={saveBudgets} onKeyDown={(e) => { if (e.key === 'Escape') setEditingBudgets(false); }} className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                    {EXPENSE_CATEGORIES.map(cat => (
                      <label key={cat} className="text-xs text-slate-400 space-y-1">
                        <span className="flex items-center gap-1.5">
                          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: categoryColors[cat] }} /> {cat}
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          inputMode="decimal"
                          placeholder="Sin límite"
                          value={budgetDraft[cat] ?? ''}
                          onChange={(e) => setBudgetDraft(d => ({ ...d, [cat]: e.target.value }))}
                          className="w-full bg-slate-800/70 border border-slate-700 rounded-lg px-3 py-2 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                        />
                      </label>
                    ))}
                  </div>
                  <div className="flex justify-end gap-2">
                    <button type="button" onClick={() => setEditingBudgets(false)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-slate-700 text-slate-300 hover:bg-slate-600">
                      <X className="w-3.5 h-3.5" /> Cancelar
                    </button>
                    <button type="submit" className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-emerald-600 text-white hover:bg-emerald-500 font-semibold">
                      <Check className="w-3.5 h-3.5" /> Guardar Presupuestos
                    </button>
                  </div>
                </form>
              ) : budgetRows.length === 0 ? (
                <p className="text-sm text-slate-500">Define cuánto quieres gastar al mes en cada categoría y te avisaremos al acercarte al límite.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                  {budgetRows.map(({ cat, status }) => {
                    const tone = status.level === 'over' ? 'bg-rose-500' : status.level === 'warn' ? 'bg-amber-400' : 'bg-emerald-500';
                    return (
                      <div key={cat} className="space-y-1.5">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-300">{cat}</span>
                          <span className="text-slate-400">
                            <span className="font-medium text-slate-200">${money(status.spent)}</span> de ${money(status.limit)}
                          </span>
                        </div>
                        <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${tone}`} style={{ width: `${Math.min(status.pct, 100)}%` }} />
                        </div>
                        <p className={`text-[11px] ${status.level === 'over' ? 'text-rose-300' : status.level === 'warn' ? 'text-amber-300' : 'text-slate-500'}`}>
                          {status.level === 'over'
                            ? `Excedido por $${money(-status.remaining)}`
                            : `Quedan $${money(status.remaining)} (${Math.round(status.pct)}% usado)`}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold text-base">Historial de Transacciones</h3>
                <button
                  onClick={() => handleExportCSV(periodTransactions, financeMonth === 'all' ? health.lastActiveDate : financeMonth)}
                  disabled={periodTransactions.length === 0}
                  title="Exporta los movimientos del periodo seleccionado"
                  className="text-xs text-emerald-400 hover:underline flex items-center gap-1 disabled:opacity-40 disabled:no-underline"
                >
                  <FileSpreadsheet className="w-3.5 h-3.5" /> Descargar CSV
                </button>
              </div>
              {periodTransactions.length === 0 ? (
                <p className="text-sm text-slate-500 py-6 text-center">No hay movimientos en este periodo.</p>
              ) : (
                <div className="space-y-2">
                  {periodTransactions.map(tr => {
                    if (editingTxId === tr.id) {
                      return (
                        <form
                          key={tr.id}
                          onSubmit={(e) => { e.preventDefault(); saveEditedTx(tr.id); }}
                          onKeyDown={(e) => { if (e.key === 'Escape') setEditingTxId(null); }}
                          className="p-4 rounded-xl bg-slate-800 border border-indigo-500/50 space-y-3"
                        >
                          <div className="grid grid-cols-2 sm:grid-cols-12 gap-2">
                            <input
                              type="text"
                              autoFocus
                              aria-label="Concepto del movimiento"
                              value={editTxForm.desc}
                              onChange={(e) => setEditTxForm({ ...editTxForm, desc: e.target.value })}
                              className="col-span-2 sm:col-span-4 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                            />
                            <input
                              type="number"
                              min="0.01"
                              step="0.01"
                              inputMode="decimal"
                              aria-label="Monto del movimiento"
                              value={editTxForm.amount}
                              onChange={(e) => setEditTxForm({ ...editTxForm, amount: e.target.value })}
                              className="sm:col-span-2 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                            />
                            <select
                              aria-label="Tipo de movimiento"
                              value={editTxForm.type}
                              onChange={(e) => setEditTxForm({ ...editTxForm, type: e.target.value })}
                              className="sm:col-span-2 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                            >
                              <option value="expense">Gasto</option>
                              <option value="income">Ingreso</option>
                            </select>
                            <select
                              aria-label="Categoría del movimiento"
                              value={editTxForm.type === 'income' ? 'Salario' : editTxForm.category}
                              disabled={editTxForm.type === 'income'}
                              onChange={(e) => setEditTxForm({ ...editTxForm, category: e.target.value })}
                              className="sm:col-span-2 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                            >
                              {editTxForm.type === 'income'
                                ? <option value="Salario">Salario</option>
                                : [...new Set([...EXPENSE_CATEGORIES, editTxForm.category].filter(c => c && c !== 'Salario'))]
                                    .map(c => <option key={c} value={c}>{c}</option>)}
                            </select>
                            <input
                              type="date"
                              aria-label="Fecha del movimiento"
                              value={editTxForm.date}
                              onChange={(e) => setEditTxForm({ ...editTxForm, date: e.target.value })}
                              className="col-span-2 sm:col-span-2 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                            />
                          </div>
                          <div className="flex justify-end gap-2">
                            <button type="button" onClick={() => setEditingTxId(null)} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-slate-700 text-slate-300 hover:bg-slate-600">
                              <X className="w-3.5 h-3.5" /> Cancelar
                            </button>
                            <button type="submit" className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-emerald-600 text-white hover:bg-emerald-500 font-semibold">
                              <Check className="w-3.5 h-3.5" /> Guardar Cambios
                            </button>
                          </div>
                        </form>
                      );
                    }

                    return (
                      <div key={tr.id} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-slate-800/40">
                        <div className="flex items-center gap-3 min-w-0">
                          {tr.type === 'income' ? <TrendingUp className="w-4 h-4 text-emerald-400 shrink-0" /> : <TrendingDown className="w-4 h-4 text-rose-400 shrink-0" />}
                          <div className="min-w-0">
                            <p className="text-sm font-medium break-words">{tr.desc}</p>
                            <p className="text-xs text-slate-400">{tr.category} • {formatReadableDate(tr.date)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className={`font-semibold text-sm mr-1 ${tr.type === 'income' ? 'text-emerald-400' : 'text-rose-400'}`}>
                            {tr.type === 'income' ? '+' : '-'}${money(tr.amount)}
                          </span>
                          <button
                            onClick={() => startEditingTx(tr)}
                            className="text-slate-500 hover:text-indigo-400 p-1 rounded-lg"
                            aria-label={`Editar movimiento: ${tr.desc}`}
                            title="Editar movimiento"
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteTransaction(tr.id)}
                            className="text-slate-500 hover:text-rose-400 p-1 rounded-lg"
                            aria-label={`Eliminar movimiento: ${tr.desc}`}
                            title="Eliminar movimiento"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= VISTA 3: SALUD Y HISTORIAL DIARIO ================= */}
        {activeTab === 'health' && (
          <div className="space-y-6">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-6">
                <div>
                  <h3 className="font-semibold text-base flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-indigo-400" /> Evolución de los Últimos 7 Días
                  </h3>
                  <p className="text-xs text-slate-400">Se archiva automáticamente a medianoche y reinicia tus metas diarias.</p>
                </div>
                <div className="flex items-center gap-4 text-xs">
                  <span className="flex items-center gap-1.5 text-indigo-300">
                    <span className="w-2.5 h-2.5 rounded-sm bg-indigo-500" /> Horas Sueño (máx 10h)
                  </span>
                  <span className="flex items-center gap-1.5 text-amber-300">
                    <span className="w-2.5 h-2.5 rounded-sm bg-amber-400" /> Nivel Energía (1-5)
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-7 gap-2 sm:gap-4 items-end h-44 pt-4 px-2 border-b border-slate-800">
                {weeklyChartData.map((d, i) => {
                  const sleepHeight = Math.min((d.sleep / 10) * 100, 100);
                  const moodHeight = Math.min((d.mood / 5) * 100, 100);
                  return (
                    <div key={i} className="flex flex-col items-center h-full justify-end">
                      <div className="flex items-end gap-1 sm:gap-1.5 w-full justify-center h-32">
                        <div className="relative w-3 sm:w-4 bg-slate-800/60 rounded-t-md h-full flex items-end">
                          <div
                            style={{ height: `${sleepHeight}%` }}
                            className={`w-full rounded-t-md transition-all duration-300 ${d.isToday ? 'bg-indigo-400' : 'bg-indigo-600/80'}`}
                            title={`${d.sleep} hrs de sueño`}
                          />
                        </div>
                        <div className="relative w-3 sm:w-4 bg-slate-800/60 rounded-t-md h-full flex items-end">
                          <div
                            style={{ height: `${moodHeight}%` }}
                            className={`w-full rounded-t-md transition-all duration-300 ${d.isToday ? 'bg-amber-400' : 'bg-amber-500/80'}`}
                            title={`Energía: ${d.mood}/5`}
                          />
                        </div>
                      </div>
                      <span className={`text-xs mt-2 font-medium ${d.isToday ? 'text-indigo-400 font-bold' : 'text-slate-400'}`}>
                        {d.day}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-6">
                <div className="flex justify-between items-center">
                  <h3 className="font-semibold text-base">Registro de Hoy</h3>
                  <span className="text-xs text-slate-400">{formatReadableDate(health.lastActiveDate)}</span>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="flex items-center gap-2 text-sky-400"><Droplets className="w-4 h-4" /> Hidratación</span>
                    <span className="flex items-center gap-1.5">
                      {health.water} /
                      <select
                        aria-label="Meta diaria de vasos de agua"
                        title="Meta diaria"
                        value={health.waterGoal}
                        onChange={(e) => {
                          const waterGoal = Number(e.target.value);
                          setHealth(prev => ({ ...prev, waterGoal }));
                        }}
                        className="bg-slate-800 border border-slate-700 rounded-md px-1 py-0.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                      >
                        {Array.from({ length: MAX_WATER }, (_, i) => i + 1).map(n => (
                          <option key={n} value={n}>{n}</option>
                        ))}
                      </select>
                      vasos
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => setHealth(prev => ({ ...prev, water: Math.max(0, prev.water - 1) }))}
                      disabled={health.water <= 0}
                      aria-label="Quitar un vaso de agua"
                      className="px-3 py-1.5 bg-slate-800 rounded-lg text-sm disabled:opacity-40"
                    >
                      -1
                    </button>
                    <button
                      onClick={() => setHealth(prev => ({ ...prev, water: Math.min(prev.water + 1, MAX_WATER) }))}
                      disabled={health.water >= MAX_WATER}
                      className="flex-1 py-1.5 bg-sky-600/20 text-sky-400 border border-sky-500/30 rounded-lg text-sm font-medium disabled:opacity-40"
                    >
                      + Registrar Vaso de Agua
                    </button>
                  </div>
                  <div className="w-full bg-slate-800 h-1.5 rounded-full mt-2 overflow-hidden">
                    <div
                      className={`h-full transition-all ${health.water >= health.waterGoal ? 'bg-emerald-400' : 'bg-sky-500'}`}
                      style={{ width: `${Math.min((health.water / health.waterGoal) * 100, 100)}%` }}
                    />
                  </div>
                </div>

                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="flex items-center gap-2 text-indigo-400"><Moon className="w-4 h-4" /> Horas de Sueño</span>
                    <span className="font-bold text-indigo-300">{health.sleepHours} hrs</span>
                  </div>
                  <input
                    type="range" min="3" max="10" step="0.5"
                    aria-label="Horas de sueño"
                    value={health.sleepHours}
                    onChange={(e) => {
                      const sleepHours = parseFloat(e.target.value);
                      setHealth(prev => ({ ...prev, sleepHours }));
                    }}
                    className="w-full accent-indigo-500"
                  />
                </div>

                <div>
                  <span className="flex items-center gap-2 text-sm text-amber-400 mb-2"><Activity className="w-4 h-4" /> Nivel de Energía / Ánimo</span>
                  <div className="grid grid-cols-5 gap-2">
                    {[1, 2, 3, 4, 5].map(lvl => (
                      <button
                        key={lvl}
                        onClick={() => setHealth(prev => ({ ...prev, mood: lvl }))}
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

              <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
                <div className="flex justify-between items-center mb-4">
                  <h3 className="font-semibold text-base">Hábitos Diarios</h3>
                  <div className="flex items-center gap-3">
                    {!editingHabits && (
                      <span className="text-xs text-emerald-400 font-medium">{completedHabits}/{health.habits.length} hoy</span>
                    )}
                    <button
                      onClick={() => (editingHabits ? finishEditingHabits() : setEditingHabits(true))}
                      className="text-xs text-indigo-400 hover:underline flex items-center gap-1"
                    >
                      {editingHabits ? <><Check className="w-3.5 h-3.5" /> Listo</> : <><Pencil className="w-3.5 h-3.5" /> Editar</>}
                    </button>
                  </div>
                </div>

                {editingHabits ? (
                  <div className="space-y-2">
                    {health.habits.map((habit, i) => (
                      <div key={habit.id} className="flex items-center gap-2">
                        <input
                          type="text"
                          aria-label={`Nombre del hábito ${i + 1}`}
                          value={habit.name}
                          onChange={(e) => renameHabit(habit.id, e.target.value)}
                          className="flex-1 min-w-0 bg-slate-800/70 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-indigo-500"
                        />
                        <button
                          onClick={() => deleteHabit(habit.id)}
                          className="text-slate-400 hover:text-rose-400 p-2 rounded-lg hover:bg-slate-800"
                          aria-label={`Eliminar hábito: ${habit.name}`}
                          title="Eliminar hábito"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <form onSubmit={addHabit} className="flex items-center gap-2 pt-2">
                      <input
                        type="text"
                        placeholder="Nuevo hábito (ej. Caminar 8,000 pasos)"
                        aria-label="Nuevo hábito"
                        value={newHabitName}
                        onChange={(e) => setNewHabitName(e.target.value)}
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
                    {health.habits.map(habit => {
                      const streak = habitStreak(habit, health);
                      return (
                        <button
                          type="button"
                          key={habit.id}
                          aria-pressed={habit.done}
                          onClick={() => toggleHabit(habit.id)}
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

            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
              <h3 className="font-semibold text-base mb-4 flex items-center gap-2">
                <History className="w-4 h-4 text-emerald-400" /> Historial Diario Archivado
              </h3>
              {(health.dailyLogs || []).length === 0 ? (
                <p className="text-sm text-slate-500">Aún no hay días anteriores archivados.</p>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {health.dailyLogs.map((log) => (
                    <div key={log.date} className="p-4 rounded-xl bg-slate-800/40 border border-slate-800 flex flex-col justify-between gap-2">
                      <div className="flex justify-between items-center">
                        <span className="text-sm font-semibold text-slate-200">{formatReadableDate(log.date)}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          {log.habitsDone}/{log.habitsTotal} hábitos
                        </span>
                      </div>
                      <div className="flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-slate-800/80">
                        <span>💧 {log.water}/{log.waterGoal} vasos</span>
                        <span>🌙 {log.sleep}h</span>
                        <span>⚡ {log.mood}/5</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ================= VISTA 4: AGENDA AVANZADA ================= */}
        {activeTab === 'agenda' && (
          <div className="space-y-6">
            {/* Formulario para Agendar Tarea con Fecha, Hora y Prioridad */}
            <div className="bg-slate-900 border border-slate-800 p-5 rounded-2xl">
              <h3 className="font-semibold text-sm text-slate-200 mb-3 flex items-center gap-2">
                <Plus className="w-4 h-4 text-indigo-400" /> Programar Nuevo Bloque o Tarea
              </h3>
              <form onSubmit={handleAddTaskManual} className="grid grid-cols-1 sm:grid-cols-12 gap-3">
                <input
                  type="text"
                  placeholder="¿Qué necesitas hacer? (ej. Revisión médica)"
                  aria-label="Título de la tarea"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  className="sm:col-span-5 bg-slate-800/70 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm focus:outline-none focus:border-indigo-500"
                />
                <input
                  type="date"
                  aria-label="Fecha de la tarea"
                  value={newTaskDate}
                  onChange={(e) => setNewTaskDate(e.target.value)}
                  className="sm:col-span-3 bg-slate-800/70 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
                <input
                  type="time"
                  aria-label="Hora de la tarea"
                  value={newTaskTime}
                  onChange={(e) => setNewTaskTime(e.target.value)}
                  className="sm:col-span-2 bg-slate-800/70 border border-slate-700 rounded-xl px-3 py-2.5 text-sm text-slate-200 focus:outline-none focus:border-indigo-500"
                />
                <div className="sm:col-span-2 flex gap-2">
                  <select
                    value={newTaskPriority}
                    onChange={(e) => setNewTaskPriority(e.target.value)}
                    className="w-full bg-slate-800/70 border border-slate-700 rounded-xl px-2.5 py-2.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                    title="Prioridad"
                    aria-label="Prioridad"
                  >
                    <option value="high">Alta</option>
                    <option value="medium">Media</option>
                    <option value="low">Baja</option>
                  </select>
                  <button
                    type="submit"
                    className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 rounded-xl text-sm font-semibold transition-colors shrink-0"
                  >
                    Crear
                  </button>
                </div>
              </form>
            </div>

            {/* Barra de Filtros por Fecha y Lista Cronológica */}
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl">
              <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 pb-4 border-b border-slate-800">
                <div className="flex flex-wrap items-center gap-2">
                  {[
                    { id: 'today', label: `Hoy (${formatReadableDate(todayKey)})` },
                    { id: 'tomorrow', label: 'Mañana' },
                    { id: 'all', label: 'Todas las fechas' },
                  ].map(tab => (
                    <button
                      key={tab.id}
                      onClick={() => {
                        setAgendaFilterMode(tab.id);
                        if (tab.id === 'today') setNewTaskDate(todayKey);
                        if (tab.id === 'tomorrow') setNewTaskDate(tomorrowKey);
                      }}
                      aria-pressed={agendaFilterMode === tab.id}
                      className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                        agendaFilterMode === tab.id
                          ? 'bg-indigo-600 text-white shadow-md'
                          : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}

                  {/* Selector de Calendario Personalizado */}
                  <div className={`flex items-center gap-1.5 bg-slate-800 px-2.5 py-1 rounded-xl border ${agendaFilterMode === 'custom' ? 'border-indigo-500' : 'border-slate-700'}`}>
                    <Calendar className="w-3.5 h-3.5 text-indigo-400" />
                    <input
                      type="date"
                      aria-label="Ver otra fecha"
                      value={customAgendaDate}
                      onChange={(e) => {
                        const value = e.target.value;
                        setCustomAgendaDate(value);
                        // Si se borra la fecha, se regresa a "Hoy" en lugar de mostrar una lista vacía.
                        setAgendaFilterMode(value ? 'custom' : 'today');
                        setNewTaskDate(value || todayKey);
                      }}
                      className="bg-transparent text-xs text-slate-200 focus:outline-none"
                    />
                  </div>
                </div>

                <span className="text-xs text-slate-400">
                  {filteredAndSortedTasks.filter(t => t.completed).length} de {filteredAndSortedTasks.length} completadas
                </span>
              </div>

              {/* Listado de Tareas Ordenadas por Hora */}
              {filteredAndSortedTasks.length === 0 ? (
                <div className="text-center py-12">
                  <Calendar className="w-10 h-10 text-slate-700 mx-auto mb-2" />
                  <p className="text-sm text-slate-400">No hay tareas programadas para esta vista.</p>
                  <p className="text-xs text-slate-500 mt-1">Usa el formulario de arriba o el Quick-Add para agendar.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredAndSortedTasks.map(task => {
                    const isEditing = editingTaskId === task.id;
                    const pBadge = priorityBadge[task.priority] || priorityBadge.medium;

                    if (isEditing) {
                      return (
                        <form
                          key={task.id}
                          onSubmit={(e) => { e.preventDefault(); saveEditedTask(task.id); }}
                          onKeyDown={(e) => { if (e.key === 'Escape') setEditingTaskId(null); }}
                          className="p-4 rounded-xl bg-slate-800 border border-indigo-500/50 space-y-3"
                        >
                          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
                            <input
                              type="text"
                              autoFocus
                              aria-label="Título"
                              value={editTaskForm.title}
                              onChange={(e) => setEditTaskForm({ ...editTaskForm, title: e.target.value })}
                              className="sm:col-span-5 bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white focus:outline-none focus:border-indigo-500"
                            />
                            <input
                              type="date"
                              aria-label="Fecha"
                              value={editTaskForm.date}
                              onChange={(e) => setEditTaskForm({ ...editTaskForm, date: e.target.value })}
                              className="sm:col-span-3 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                            />
                            <input
                              type="time"
                              aria-label="Hora"
                              value={editTaskForm.time}
                              onChange={(e) => setEditTaskForm({ ...editTaskForm, time: e.target.value })}
                              className="sm:col-span-2 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                            />
                            <select
                              aria-label="Prioridad"
                              value={editTaskForm.priority}
                              onChange={(e) => setEditTaskForm({ ...editTaskForm, priority: e.target.value })}
                              className="sm:col-span-2 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-indigo-500"
                            >
                              <option value="high">Alta</option>
                              <option value="medium">Media</option>
                              <option value="low">Baja</option>
                            </select>
                          </div>
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setEditingTaskId(null)}
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-slate-700 text-slate-300 hover:bg-slate-600"
                            >
                              <X className="w-3.5 h-3.5" /> Cancelar
                            </button>
                            <button
                              type="submit"
                              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-emerald-600 text-white hover:bg-emerald-500 font-semibold"
                            >
                              <Check className="w-3.5 h-3.5" /> Guardar Cambios
                            </button>
                          </div>
                        </form>
                      );
                    }

                    return (
                      <div key={task.id} className="flex items-center justify-between p-3.5 rounded-xl bg-slate-800/40 hover:bg-slate-800/70 border border-slate-800/80 transition-colors">
                        <button
                          type="button"
                          onClick={() => toggleTask(task.id)}
                          aria-pressed={task.completed}
                          className="flex items-center gap-3 cursor-pointer flex-1 min-w-0 text-left"
                        >
                          {task.completed ? <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" /> : <Circle className="w-5 h-5 text-slate-500 shrink-0" />}
                          <div className="min-w-0">
                            <p className={`text-sm font-medium break-words ${task.completed ? 'line-through text-slate-500' : 'text-slate-100'}`}>
                              {task.title}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <span className="text-xs text-indigo-400 font-medium flex items-center gap-1">
                                <Clock className="w-3 h-3" /> {task.time && task.time !== 'Sin hora' ? task.time : 'Sin hora'}
                              </span>
                              {isOverdue(task) ? (
                                <span className="text-[11px] text-rose-300 bg-rose-500/10 border border-rose-500/30 px-2 py-0.5 rounded-md">
                                  Atrasada · {formatReadableDate(task.date)}
                                </span>
                              ) : agendaFilterMode === 'all' && (
                                <span className="text-[11px] text-slate-400 bg-slate-900 px-2 py-0.5 rounded-md">
                                  {formatReadableDate(task.date || todayKey)}
                                </span>
                              )}
                              <span className={`text-[10px] px-2 py-0.5 rounded-full border flex items-center gap-1 ${pBadge.cls}`}>
                                <Flag className="w-2.5 h-2.5" /> {pBadge.label}
                              </span>
                            </div>
                          </div>
                        </button>

                        <div className="flex items-center gap-1.5 ml-2 shrink-0">
                          {isOverdue(task) && (
                            <button
                              onClick={() => moveTaskToToday(task.id)}
                              className="text-[11px] font-semibold text-indigo-300 hover:text-indigo-200 px-2 py-1 rounded-lg bg-indigo-500/10 border border-indigo-500/30"
                              aria-label={`Mover a hoy: ${task.title}`}
                            >
                              Mover a hoy
                            </button>
                          )}
                          <button
                            onClick={() => startEditingTask(task)}
                            className="text-slate-400 hover:text-indigo-400 p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors"
                            title="Editar tarea"
                            aria-label={`Editar tarea: ${task.title}`}
                          >
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => deleteTask(task.id)}
                            className="text-slate-400 hover:text-rose-400 p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors"
                            title="Eliminar tarea"
                            aria-label={`Eliminar tarea: ${task.title}`}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
