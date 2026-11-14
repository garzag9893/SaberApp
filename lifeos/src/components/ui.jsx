import { Check, X } from 'lucide-react';

export const money = (n) => n.toLocaleString('es-MX', {
  minimumFractionDigits: Number.isInteger(n) ? 0 : 2,
  maximumFractionDigits: 2,
});

export const newId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

// Clases compartidas para mantener el mismo estilo en todas las vistas.
export const ui = {
  card: 'bg-slate-900 border border-slate-800 rounded-2xl',
  input: 'w-full bg-slate-800/70 border border-slate-700 rounded-xl px-3.5 py-2.5 text-sm text-slate-100 placeholder-slate-500 focus:outline-none focus:border-indigo-500',
  inputSm: 'w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500',
  label: 'block text-[11px] font-medium text-slate-400 mb-1',
  primary: 'bg-indigo-600 hover:bg-indigo-500 text-white font-semibold rounded-xl transition-colors',
  link: 'text-xs text-indigo-400 hover:underline flex items-center gap-1',
  iconBtn: 'text-slate-400 p-1.5 rounded-lg hover:bg-slate-700/50 transition-colors',
};

export const PRIORITY = {
  high: { label: 'Alta', cls: 'bg-rose-500/15 text-rose-400 border-rose-500/30' },
  medium: { label: 'Media', cls: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  low: { label: 'Baja', cls: 'bg-slate-700/50 text-slate-400 border-slate-600/40' },
};

export function EditActions({ onCancel, saveLabel = 'Guardar Cambios' }) {
  return (
    <div className="flex justify-end gap-2">
      <button type="button" onClick={onCancel} className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-slate-700 text-slate-300 hover:bg-slate-600">
        <X className="w-3.5 h-3.5" /> Cancelar
      </button>
      <button type="submit" className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs bg-emerald-600 text-white hover:bg-emerald-500 font-semibold">
        <Check className="w-3.5 h-3.5" /> {saveLabel}
      </button>
    </div>
  );
}

export function Field({ label, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className={ui.label}>{label}</span>
      {children}
    </label>
  );
}

export function SectionTitle({ icon: Icon, iconClass = 'text-indigo-400', children, sub }) {
  return (
    <div>
      <h3 className="font-semibold text-base flex items-center gap-2">
        {Icon && <Icon className={`w-4 h-4 ${iconClass}`} />} {children}
      </h3>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  );
}
