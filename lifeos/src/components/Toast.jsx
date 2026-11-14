import { Sparkles } from 'lucide-react';

export default function Toast({ toast, onDismiss }) {
  if (!toast) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-50 bg-indigo-600 text-white px-4 py-3 rounded-xl shadow-2xl flex items-center gap-2"
    >
      <Sparkles className="w-4 h-4 shrink-0" />
      <span className="text-sm font-medium flex-1">{toast.msg}</span>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action.onClick();
            onDismiss();
          }}
          className="shrink-0 text-xs font-bold uppercase tracking-wide bg-white/15 hover:bg-white/25 px-2.5 py-1 rounded-lg"
        >
          {toast.action.label}
        </button>
      )}
    </div>
  );
}
