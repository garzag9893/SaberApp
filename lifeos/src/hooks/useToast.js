import { useState, useRef, useCallback, useEffect } from 'react';

// Aviso flotante. `action` opcional: { label, onClick } — p. ej. "Deshacer" tras borrar algo.
export function useToast() {
  const [toast, setToast] = useState(null);
  const timerRef = useRef(null);

  const dismissToast = useCallback(() => {
    clearTimeout(timerRef.current);
    setToast(null);
  }, []);

  const showToast = useCallback((msg, action = null) => {
    setToast({ msg, action, key: Date.now() });
    clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setToast(null), action ? 7000 : 4000);
  }, []);

  useEffect(() => () => clearTimeout(timerRef.current), []);

  return { toast, showToast, dismissToast };
}
