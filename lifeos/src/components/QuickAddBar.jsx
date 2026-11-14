import { useState } from 'react';
import { Plus, Sparkles } from 'lucide-react';

export default function QuickAddBar({ onSubmit }) {
  const [text, setText] = useState('');
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        if (text.trim() && onSubmit(text)) setText('');
      }}
      className="mb-8"
    >
      <div className="relative flex items-center">
        <Sparkles className="w-5 h-5 text-indigo-400 absolute left-4" />
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Entrada rápida"
          placeholder="Entrada rápida: 'Comida $180', 'Dentista mañana 16:00', 'Gym cada lunes 7am'..."
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
  );
}
