// Ilustraciones de LifeOS: vectoriales, con los colores del sistema (cambian con el tema)
// y el motivo del reloj del día. Volumen suave: cada objeto lleva una sombra elíptica
// y un segundo tono más claro como brillo.

const polar = (cx, cy, minutes, r) => {
  const a = (minutes / 1440) * 2 * Math.PI - Math.PI / 2;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
};

const arc = (cx, cy, start, end, r) => {
  const [x1, y1] = polar(cx, cy, start, r);
  const [x2, y2] = polar(cx, cy, end, r);
  return `M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 ${end - start > 720 ? 1 : 0} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`;
};

const Shadow = ({ cx, cy, rx, ry = 5 }) => <ellipse cx={cx} cy={cy} rx={rx} ry={ry} className="fill-slate-950/60" />;

function Frame({ children, label, className = 'w-36 h-28' }) {
  return (
    <svg viewBox="0 0 160 120" className={className} role="img" aria-label={label}>
      {children}
    </svg>
  );
}

// Agenda vacía: un reloj sin tareas y un botón para agregar.
export function EmptyCalendar({ className }) {
  const [hx, hy] = polar(80, 56, 600, 30);
  return (
    <Frame label="Reloj del día sin tareas" className={className}>
      <Shadow cx={80} cy={106} rx={38} />
      <circle cx={80} cy={56} r={40} className="fill-slate-800" />
      <circle cx={80} cy={56} r={31} fill="none" className="stroke-slate-700" strokeWidth={9} />
      <path d={arc(80, 56, 1100, 1260, 31)} fill="none" className="stroke-indigo-400/60 lo-draw" strokeWidth={9} pathLength={1} />
      <line x1={80} y1={56} x2={hx} y2={hy} className="stroke-amber-400" strokeWidth={3} strokeLinecap="round" />
      <circle cx={hx} cy={hy} r={4} className="fill-amber-400" />
      <circle cx={80} cy={56} r={3} className="fill-slate-600" />
      <g className="lo-pop" style={{ transformOrigin: '118px 86px' }}>
        <circle cx={118} cy={86} r={14} className="fill-indigo-600" />
        <circle cx={114} cy={82} r={5} className="fill-white/20" />
        <path d="M118 80 V92 M112 86 H124" className="stroke-white" strokeWidth={2.5} strokeLinecap="round" />
      </g>
    </Frame>
  );
}

// Finanzas sin movimientos: cartera con una moneda.
export function EmptyWallet({ className }) {
  return (
    <Frame label="Cartera vacía" className={className}>
      <Shadow cx={80} cy={106} rx={44} />
      <rect x={38} y={40} width={84} height={58} rx={14} className="fill-slate-700" />
      <rect x={38} y={34} width={76} height={22} rx={10} className="fill-slate-600" />
      <rect x={96} y={58} width={30} height={22} rx={8} className="fill-slate-800" />
      <circle cx={109} cy={69} r={4} className="fill-slate-500" />
      <g className="lo-pop" style={{ transformOrigin: '64px 30px' }}>
        <circle cx={64} cy={30} r={16} className="fill-amber-500" />
        <circle cx={64} cy={30} r={11} fill="none" className="stroke-amber-300" strokeWidth={2} />
        <circle cx={59} cy={25} r={4} className="fill-white/25" />
      </g>
    </Frame>
  );
}

// Sin hábitos: un brote en maceta.
export function EmptySprout({ className }) {
  return (
    <Frame label="Brote recién plantado" className={className}>
      <Shadow cx={80} cy={106} rx={30} />
      <path d="M58 72 H102 L96 102 Q95 106 90 106 H70 Q65 106 64 102 Z" className="fill-slate-700" />
      <rect x={54} y={66} width={52} height={12} rx={6} className="fill-slate-600" />
      <path d="M80 66 V44" className="stroke-emerald-500" strokeWidth={3.5} strokeLinecap="round" />
      <g className="lo-pop" style={{ transformOrigin: '80px 50px' }}>
        <path d="M80 50 C66 50 58 40 58 28 C70 28 80 36 80 50 Z" className="fill-emerald-400" />
        <path d="M80 44 C92 44 102 36 102 22 C88 22 80 30 80 44 Z" className="fill-emerald-300" />
      </g>
      <circle cx={110} cy={36} r={3} className="fill-amber-400 lo-twinkle" />
      <circle cx={50} cy={46} r={2} className="fill-amber-400/70 lo-twinkle" />
    </Frame>
  );
}

// Búsqueda sin resultados: lupa sobre el reloj.
export function EmptySearch({ className }) {
  return (
    <Frame label="Búsqueda sin resultados" className={className}>
      <Shadow cx={80} cy={106} rx={36} />
      <circle cx={70} cy={54} r={32} fill="none" className="stroke-slate-800" strokeWidth={8} />
      <path d={arc(70, 54, 200, 520, 32)} fill="none" className="stroke-slate-700" strokeWidth={8} />
      <circle cx={88} cy={66} r={22} className="fill-slate-900 stroke-slate-500" strokeWidth={6} />
      <circle cx={81} cy={59} r={6} className="fill-white/10" />
      <path d="M104 82 L122 100" className="stroke-slate-500" strokeWidth={9} strokeLinecap="round" />
    </Frame>
  );
}

// Ilustración principal de la bienvenida. `stage` (0–2) va completando el día.
const HERO_TASKS = [
  { start: 420, end: 480, stage: 0, tone: 'stroke-emerald-400' },
  { start: 540, end: 600, stage: 1, tone: 'stroke-indigo-400' },
  { start: 780, end: 825, stage: 1, tone: 'stroke-indigo-400' },
  { start: 990, end: 1080, stage: 2, tone: 'stroke-indigo-300' },
  { start: 1200, end: 1260, stage: 2, tone: 'stroke-sky-400' },
];

export function WelcomeDial({ stage = 0, className = 'w-full max-w-[22rem] h-auto' }) {
  const cx = 160;
  const cy = 150;
  const r = 104;
  const [hx, hy] = polar(cx, cy, 630, r + 18);
  const [ix, iy] = polar(cx, cy, 630, 34);
  return (
    <svg viewBox="0 0 320 300" className={className} role="img" aria-label="El día como un reloj de 24 horas, con tareas como arcos">
      <ellipse cx={cx} cy={286} rx={120} ry={9} className="fill-slate-950/70" />
      <circle cx={cx} cy={cy} r={132} className="fill-slate-900" />
      <circle cx={cx} cy={cy} r={132} fill="none" className="stroke-slate-800" strokeWidth={2} />
      <circle cx={cx} cy={cy} r={r} fill="none" className="stroke-slate-800" strokeWidth={22} />
      {Array.from({ length: 24 }, (_, h) => {
        const major = h % 6 === 0;
        const [x1, y1] = polar(cx, cy, h * 60, r + 17);
        const [x2, y2] = polar(cx, cy, h * 60, r + (major ? 25 : 21));
        return <line key={h} x1={x1} y1={y1} x2={x2} y2={y2} className={major ? 'stroke-slate-400' : 'stroke-slate-700'} strokeWidth={major ? 2.5 : 1.5} strokeLinecap="round" />;
      })}
      {HERO_TASKS.filter((t) => t.stage <= stage).map((t) => (
        <path key={t.start} d={arc(cx, cy, t.start + 4, t.end - 4, r)} fill="none" className={`${t.tone} lo-draw`} strokeWidth={22} pathLength={1} />
      ))}
      <path d={arc(cx, cy, 0, 630, r - 22)} fill="none" className="stroke-amber-400/35" strokeWidth={3} strokeLinecap="round" />
      <line x1={ix} y1={iy} x2={hx} y2={hy} className="stroke-amber-400" strokeWidth={5} strokeLinecap="round" />
      <circle cx={hx} cy={hy} r={9} className="fill-amber-400 stroke-slate-900" strokeWidth={4} />
      <circle cx={cx} cy={cy} r={58} className="fill-slate-800/70" />
      <text x={cx} y={cy - 8} textAnchor="middle" className="fill-amber-400 num" fontSize="11" letterSpacing="2.5">AHORA</text>
      <text x={cx} y={cy + 18} textAnchor="middle" className="fill-slate-50 num" fontSize="26" fontWeight="600">10:30</text>

      {/* Objetos flotantes: dinero, agua y hábitos (aparecen con las etapas) */}
      {stage >= 1 && (
        <g className="lo-pop lo-float" style={{ transformOrigin: '268px 66px' }}>
          <circle cx={268} cy={66} r={22} className="fill-amber-500" />
          <circle cx={268} cy={66} r={15} fill="none" className="stroke-amber-300" strokeWidth={2.5} />
          <circle cx={261} cy={59} r={5} className="fill-white/25" />
        </g>
      )}
      {stage >= 1 && (
        <g className="lo-pop lo-float-slow" style={{ transformOrigin: '42px 214px' }}>
          <path d="M42 190 C42 190 26 210 26 220 A16 16 0 0 0 58 220 C58 210 42 190 42 190 Z" className="fill-sky-400" />
          <circle cx={36} cy={216} r={4} className="fill-white/30" />
        </g>
      )}
      {stage >= 2 && (
        <g className="lo-pop lo-float" style={{ transformOrigin: '274px 236px' }}>
          <circle cx={274} cy={236} r={20} className="fill-emerald-500" />
          <path d="M265 236 L271 242 L284 229" fill="none" className="stroke-white" strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
    </svg>
  );
}
