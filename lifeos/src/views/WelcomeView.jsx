import { useState, useRef } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, Wallet, Droplets, Sparkles, Upload, Check } from 'lucide-react';
import { parseQuickAdd } from '../lib/quickAdd.js';
import { addDaysToKey, formatReadableDate } from '../lib/dates.js';
import { REPEAT_LABEL } from '../lib/recurrence.js';
import { WelcomeDial } from '../components/Illustrations.jsx';
import LogoMark from '../components/LogoMark.jsx';
import { ui, money } from '../components/ui.jsx';

const EXAMPLES = ['Dentista mañana 4pm', 'Comida $180', 'Gym cada lunes 7am', '2 vasos de agua'];

// Lo que entendería la entrada rápida, sin guardar nada.
function Preview({ text, todayKey, categories }) {
  if (!text.trim()) {
    return <p className="text-sm text-slate-500">Escribe algo o toca un ejemplo.</p>;
  }
  const r = parseQuickAdd(text, todayKey, { categories });
  let Icon = CalendarDays;
  let kind = 'Tarea';
  let main = '';
  const details = [];
  if (r.kind === 'transaction') {
    Icon = Wallet;
    kind = r.type === 'income' ? 'Ingreso' : 'Gasto';
    main = r.desc;
    details.push(`$${money(r.amount)}`, r.category);
  } else if (r.kind === 'water') {
    Icon = Droplets;
    kind = 'Agua';
    main = `+${r.glasses} ${r.glasses === 1 ? 'vaso' : 'vasos'} hoy`;
  } else {
    main = r.title;
    details.push(r.date === todayKey ? 'Hoy' : r.date === addDaysToKey(todayKey, 1) ? 'Mañana' : formatReadableDate(r.date));
    if (r.time) details.push(r.time);
    if (r.repeat !== 'none') details.push(`Se repite: ${REPEAT_LABEL[r.repeat].toLowerCase()}`);
  }
  return (
    <div className="flex items-start gap-3" aria-live="polite">
      <span className="w-9 h-9 rounded-xl bg-indigo-500/15 text-indigo-300 flex items-center justify-center shrink-0">
        <Icon className="w-4.5 h-4.5" />
      </span>
      <div className="min-w-0">
        <p className="text-[11px] uppercase tracking-[0.16em] text-slate-500">{kind}</p>
        <p className="text-slate-100 font-medium break-words">{main}</p>
        {details.length > 0 && (
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {details.map((d) => (
              <span key={d} className="num text-xs px-2 py-0.5 rounded-md bg-slate-800 text-slate-300">{d}</span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Choice({ selected, onSelect, title, text }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`w-full text-left p-4 rounded-2xl border transition-all ${
        selected ? 'border-indigo-400 bg-indigo-500/10' : 'border-slate-700 bg-slate-900 hover:border-slate-600'
      }`}
    >
      <span className="flex items-start gap-3">
        <span className={`mt-0.5 w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${selected ? 'border-indigo-400 bg-indigo-400' : 'border-slate-600'}`}>
          {selected && <Check className="w-3 h-3 text-slate-950" strokeWidth={3} />}
        </span>
        <span>
          <span className="block font-semibold text-slate-100">{title}</span>
          <span className="block text-sm text-slate-400 mt-0.5">{text}</span>
        </span>
      </span>
    </button>
  );
}

// Bienvenida de la primera vez (o al volver a verla desde Ajustes, con `revisit`).
export default function WelcomeView({ todayKey, categories, initialName = '', revisit = false, onFinish, onImportFile }) {
  const [step, setStepState] = useState(0);
  // En el celular, cada paso empieza arriba.
  const setStep = (n) => {
    setStepState(n);
    window.scrollTo({ top: 0 });
  };
  const [name, setName] = useState(initialName);
  const [demo, setDemo] = useState(EXAMPLES[0]);
  const [start, setStart] = useState('demo');
  const fileRef = useRef(null);
  const last = 2;

  const finish = () => onFinish({ name: name.trim(), start: revisit ? 'keep' : start });
  const next = () => (step < last ? setStep(step + 1) : finish());

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 grid lg:grid-cols-[1.05fr_1fr]">
      {/* Arte: el reloj del día se completa con cada paso */}
      <div className="relative overflow-hidden flex flex-col items-center justify-center px-6 pt-8 pb-2 lg:p-12 bg-gradient-to-br from-indigo-950/70 via-slate-950 to-slate-950">
        <div className="absolute top-6 left-6 flex items-center gap-2.5">
          <LogoMark className="w-9 h-9" />
          <span className="font-display font-bold text-lg">LifeOS</span>
        </div>
        <WelcomeDial stage={step} className="w-full max-w-[15rem] sm:max-w-[19rem] lg:max-w-[26rem] h-auto mt-10 lg:mt-0" />
      </div>

      {/* Contenido */}
      <main className="flex flex-col justify-center px-6 sm:px-12 py-8 lg:py-16">
        <div className="w-full max-w-lg">
          <div className="flex items-center gap-3 mb-8" aria-label={`Paso ${step + 1} de ${last + 1}`}>
            {[0, 1, 2].map((i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all duration-300 ${i === step ? 'w-10 bg-amber-400' : i < step ? 'w-6 bg-indigo-400' : 'w-6 bg-slate-800'}`} />
            ))}
            <span className="text-xs text-slate-500 num ml-1">{step + 1}/{last + 1}</span>
          </div>

          <div key={step} className="lo-rise">
            {step === 0 && (
              <>
                <p className="text-xs uppercase tracking-[0.22em] font-semibold text-amber-400">{revisit ? 'Recorrido' : 'Bienvenida'}</p>
                <h1 className="font-display text-4xl sm:text-5xl font-bold leading-[1.02] mt-3">Tu día, en un solo vistazo.</h1>
                <p className="text-slate-300 mt-5 text-lg leading-relaxed">
                  LifeOS junta tu agenda, tu dinero y tus hábitos alrededor de un reloj de 24 horas.
                  Todo se guarda en este dispositivo.
                </p>
                <label className="block mt-8">
                  <span className={ui.label}>¿Cómo te llamamos? (opcional)</span>
                  <input
                    type="text" value={name} maxLength={40} autoComplete="given-name" placeholder="Tu nombre"
                    onChange={(e) => setName(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') next(); }}
                    className={`${ui.input} text-base py-3`}
                  />
                </label>
              </>
            )}

            {step === 1 && (
              <>
                <p className="text-xs uppercase tracking-[0.22em] font-semibold text-amber-400">Entrada rápida</p>
                <h1 className="font-display text-4xl sm:text-5xl font-bold leading-[1.02] mt-3">Escribe como hablas.</h1>
                <p className="text-slate-300 mt-5 text-lg leading-relaxed">Una sola barra entiende tareas, gastos y agua. Pruébala:</p>
                <div className="mt-6 rounded-2xl border border-slate-700 bg-slate-900 overflow-hidden">
                  <div className="relative">
                    <Sparkles className="w-4 h-4 text-indigo-400 absolute left-4 top-1/2 -translate-y-1/2" />
                    <input
                      type="text" value={demo} onChange={(e) => setDemo(e.target.value)} aria-label="Prueba la entrada rápida"
                      className="w-full bg-transparent pl-11 pr-4 py-3.5 text-base text-slate-100 placeholder-slate-500 focus:outline-none border-b border-slate-800"
                      placeholder="Ej. Café con Ana el viernes 9am"
                    />
                  </div>
                  <div className="p-4 min-h-[5.5rem]">
                    <Preview text={demo} todayKey={todayKey} categories={categories} />
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mt-4">
                  {EXAMPLES.map((ex) => (
                    <button
                      key={ex} type="button" onClick={() => setDemo(ex)}
                      className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${demo === ex ? 'border-indigo-400 text-indigo-300 bg-indigo-500/10' : 'border-slate-700 text-slate-400 hover:text-slate-200'}`}
                    >
                      {ex}
                    </button>
                  ))}
                </div>
                <p className="text-xs text-slate-500 mt-4">Aquí solo es una prueba: no se guarda nada.</p>
              </>
            )}

            {step === 2 && (
              <>
                <p className="text-xs uppercase tracking-[0.22em] font-semibold text-amber-400">{revisit ? 'Listo' : 'Último paso'}</p>
                <h1 className="font-display text-4xl sm:text-5xl font-bold leading-[1.02] mt-3">
                  {revisit ? 'Eso es todo.' : '¿Cómo quieres empezar?'}
                </h1>
                {revisit ? (
                  <p className="text-slate-300 mt-5 text-lg leading-relaxed">Tus datos siguen como los dejaste.</p>
                ) : (
                  <>
                    <div className="mt-7 space-y-3" role="radiogroup" aria-label="Cómo empezar">
                      <Choice
                        selected={start === 'demo'} onSelect={() => setStart('demo')}
                        title="Con un día de ejemplo"
                        text="Explora con tareas, movimientos y hábitos ya cargados. Los borras cuando quieras en Ajustes."
                      />
                      <Choice
                        selected={start === 'empty'} onSelect={() => setStart('empty')}
                        title="Desde cero"
                        text="Todo vacío, para empezar con lo tuyo."
                      />
                    </div>
                    <button type="button" onClick={() => fileRef.current?.click()} className={`${ui.link} mt-5`}>
                      <Upload className="w-3.5 h-3.5" /> ¿Ya tienes un respaldo? Restáuralo
                    </button>
                    <input
                      ref={fileRef} type="file" accept=".json,application/json" className="hidden" aria-label="Archivo de respaldo"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) onImportFile(file, () => onFinish({ name: name.trim(), start: 'keep' }));
                        e.target.value = '';
                      }}
                    />
                  </>
                )}
              </>
            )}
          </div>

          <div className="flex items-center justify-between gap-3 mt-10">
            {step > 0 ? (
              <button type="button" onClick={() => setStep(step - 1)} className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200 px-2 py-2.5">
                <ArrowLeft className="w-4 h-4" /> Atrás
              </button>
            ) : (
              <button type="button" onClick={finish} className="text-sm text-slate-500 hover:text-slate-300 px-2 py-2.5">
                {revisit ? 'Cerrar' : 'Saltar'}
              </button>
            )}
            <button type="button" onClick={next} className={`${ui.primary} px-6 py-3 text-sm flex items-center gap-2`}>
              {step < last ? <>Continuar <ArrowRight className="w-4 h-4" /></> : 'Entrar a LifeOS'}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
