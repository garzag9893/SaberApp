// Marca de LifeOS: el reloj del día en miniatura (mismo dibujo que el icono de la app).
export default function LogoMark({ className = 'w-8 h-8' }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="8" className="fill-slate-800" />
      <circle cx="16" cy="16" r="10.5" fill="none" className="stroke-slate-700" strokeWidth="3.5" />
      <path d="M 26.1 18.7 A 10.5 10.5 0 0 1 17.4 26.4" fill="none" className="stroke-emerald-400" strokeWidth="3.5" />
      <path d="M 16.0 26.5 A 10.5 10.5 0 0 1 6.9 21.3" fill="none" className="stroke-indigo-400" strokeWidth="3.5" />
      <line x1="13.59" y1="16.65" x2="3.44" y2="19.36" className="stroke-amber-400" strokeWidth="2" strokeLinecap="round" />
      <circle cx="3.44" cy="19.36" r="2.2" className="fill-amber-400" />
    </svg>
  );
}
