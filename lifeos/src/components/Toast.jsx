import { Sparkles } from 'lucide-react';

// La región viva está siempre montada: los lectores de pantalla solo anuncian
// los cambios dentro de una región que ya existía, no una que aparece con el texto.
export default function Toast({ toast, onDismiss }) {
  return (
    <div role="status" aria-live="polite" aria-atomic="true">
      {toast && (
        <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:max-w-md z-50 bg-indigo-600 text-white px-4 py-2 rounded-xl shadow-2xl flex items-center gap-2">
          <Sparkles className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span className="text-sm font-medium flex-1 py-1">{toast.msg}</span>
          {toast.action && (
            <button
              type="button"
              onClick={() => {
                toast.action.onClick();
                onDismiss();
              }}
              className="shrink-0 text-xs font-bold uppercase tracking-wide bg-white/15 hover:bg-white/25 px-3 min-h-11 rounded-lg"
            >
              {toast.action.label}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
