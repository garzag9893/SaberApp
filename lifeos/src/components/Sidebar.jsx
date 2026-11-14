import { useState, useRef } from 'react';
import {
  LayoutDashboard, Wallet, HeartPulse, Calendar, Settings, Cloud, CloudOff,
  Download, Upload, FileSpreadsheet, RotateCcw, Smartphone,
} from 'lucide-react';
import { formatReadableDate } from '../lib/dates.js';
import LogoMark from './LogoMark.jsx';

export const TABS = [
  { id: 'dashboard', label: 'Hoy (Resumen)', icon: LayoutDashboard },
  { id: 'finances', label: 'Finanzas', icon: Wallet },
  { id: 'health', label: 'Salud y Hábitos', icon: HeartPulse },
  { id: 'agenda', label: 'Agenda', icon: Calendar },
  { id: 'settings', label: 'Ajustes', icon: Settings },
];

const BADGE = {
  synced: { label: 'Nube', title: 'Sincronizado en la nube', Icon: Cloud, cls: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' },
  syncing: { label: 'Subiendo', title: 'Sincronizando con la nube…', Icon: Cloud, cls: 'bg-indigo-500/10 border-indigo-500/30 text-indigo-300' },
  error: { label: 'Reintentar', title: 'No se pudo sincronizar; los datos siguen guardados en este dispositivo', Icon: CloudOff, cls: 'bg-rose-500/10 border-rose-500/30 text-rose-400' },
  signedout: { label: 'Entrar', title: 'Inicia sesión para sincronizar con la nube', Icon: CloudOff, cls: 'bg-amber-500/10 border-amber-500/30 text-amber-300' },
  local: { label: 'Local', title: 'Guardado en este dispositivo', Icon: CloudOff, cls: 'bg-slate-800 border-slate-700 text-slate-400' },
};

function CloudBadge({ cloud }) {
  const badge = BADGE[cloud.status] || BADGE.local;
  const { Icon } = badge;
  const clickable = cloud.status === 'signedout' || cloud.status === 'error';
  const content = (
    <>
      <Icon className="w-3 h-3" />
      <span>{badge.label}</span>
    </>
  );
  const cls = `flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border ${badge.cls}`;
  if (!clickable) return <div title={badge.title} className={cls}>{content}</div>;
  return (
    <button
      type="button"
      title={badge.title}
      className={cls}
      aria-expanded={cloud.status === 'signedout' ? cloud.showLogin : undefined}
      onClick={() => (cloud.status === 'error' ? cloud.retry() : cloud.setShowLogin((v) => !v))}
    >
      {content}
    </button>
  );
}

function LoginForm({ cloud }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const submit = async (mode) => {
    if (await cloud.authenticate(mode, email, password)) setPassword('');
  };
  const input = 'w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-slate-100 focus:outline-none focus:border-indigo-500';
  return (
    <form
      onSubmit={(e) => { e.preventDefault(); submit('signin'); }}
      className="mb-4 p-3 rounded-xl bg-slate-800/60 border border-slate-700 space-y-2"
    >
      <p className="text-xs text-slate-400">Entra para respaldar y sincronizar tus datos entre dispositivos.</p>
      <input type="email" autoComplete="email" placeholder="Correo" aria-label="Correo" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
      <input type="password" autoComplete="current-password" placeholder="Contraseña" aria-label="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} className={input} />
      <div className="grid grid-cols-2 gap-1.5">
        <button type="submit" disabled={cloud.authBusy} className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white text-xs font-semibold py-1.5 rounded-lg">
          Entrar
        </button>
        <button type="button" disabled={cloud.authBusy} onClick={() => submit('signup')} className="bg-slate-700 hover:bg-slate-600 disabled:opacity-50 text-slate-200 text-xs py-1.5 rounded-lg">
          Crear cuenta
        </button>
      </div>
    </form>
  );
}

export default function Sidebar({
  activeTab, onTab, todayKey, cloud, install, simOffset, onSimulateDay, onBackToRealDate,
  onExportJSON, onExportCSV, onImportFile,
}) {
  const fileInputRef = useRef(null);
  const smallBtn = 'flex items-center justify-center gap-1.5 bg-slate-800/70 hover:bg-slate-800 text-slate-300 text-xs py-2 px-2 rounded-lg border border-slate-700/60 transition-colors';

  return (
    <aside className="w-full md:w-64 md:shrink-0 bg-slate-900 border-b md:border-b-0 md:border-r border-slate-800 p-4 flex flex-col justify-between">
      <div>
        <div className="flex items-center justify-between px-2 mb-6">
          <div className="flex items-center gap-3">
            <LogoMark className="w-9 h-9 shrink-0" />
            <div>
              <h1 className="font-bold text-lg tracking-tight">LifeOS</h1>
              <p className="text-xs text-indigo-400 font-medium">{formatReadableDate(todayKey)}</p>
            </div>
          </div>
          <CloudBadge cloud={cloud} />
        </div>

        {cloud.enabled && !cloud.session && cloud.showLogin && <LoginForm cloud={cloud} />}

        <nav className="flex md:flex-col gap-1 overflow-x-auto">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => onTab(id)}
              aria-current={activeTab === id ? 'page' : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium border transition-all whitespace-nowrap ${
                activeTab === id
                  ? 'bg-indigo-600/20 text-indigo-400 border-indigo-500/30'
                  : 'border-transparent text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>
      </div>

      <div className="hidden md:block mt-6 pt-4 border-t border-slate-800 space-y-2.5">
        {install.canInstall && (
          <button
            onClick={install.install}
            className="w-full flex items-center justify-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 text-xs font-medium py-2 px-3 rounded-lg border border-emerald-500/30 transition-colors"
          >
            <Smartphone className="w-3.5 h-3.5" /> Instalar como app
          </button>
        )}
        <button
          onClick={onSimulateDay}
          className="w-full flex items-center justify-center gap-1.5 bg-indigo-500/10 hover:bg-indigo-500/20 text-indigo-300 text-xs font-medium py-2 px-3 rounded-lg border border-indigo-500/30 transition-colors"
          title="Archiva los datos de hoy en el historial y reinicia el día"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Simular Nuevo Día
        </button>
        {simOffset > 0 && (
          <button onClick={onBackToRealDate} className="w-full text-xs text-amber-300 hover:text-amber-200 py-1" title="Regresa a la fecha real">
            Simulación: +{simOffset} {simOffset === 1 ? 'día' : 'días'} · Volver a la fecha real
          </button>
        )}

        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 px-2 pt-1">Datos y Respaldo</p>
        <div className="grid grid-cols-2 gap-1.5">
          <button onClick={onExportJSON} className={smallBtn}>
            <Download className="w-3.5 h-3.5 text-indigo-400" /> JSON
          </button>
          <button onClick={onExportCSV} title="Exporta todos los movimientos" className={smallBtn}>
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400" /> Excel
          </button>
        </div>
        <button
          onClick={() => fileInputRef.current?.click()}
          className="w-full flex items-center justify-center gap-1.5 bg-slate-800/40 hover:bg-slate-800 text-slate-400 hover:text-slate-200 text-xs py-2 px-3 rounded-lg border border-dashed border-slate-700 transition-colors"
        >
          <Upload className="w-3.5 h-3.5" /> Restaurar Respaldo
        </button>
        <input
          type="file"
          accept=".json,application/json"
          ref={fileInputRef}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onImportFile(file);
            e.target.value = '';
          }}
          className="hidden"
        />

        {cloud.session && (
          <div className="flex items-center justify-between gap-2 px-1 pt-1 text-xs text-slate-500">
            <span className="truncate" title={cloud.session.email}>{cloud.session.email}</span>
            <button onClick={cloud.logout} className="shrink-0 text-slate-400 hover:text-slate-200 underline">Cerrar sesión</button>
          </div>
        )}
      </div>
    </aside>
  );
}
