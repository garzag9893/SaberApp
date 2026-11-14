import { useState, useEffect } from 'react';

// Minuto actual del día (0–1439), actualizado cada 30 s.
export function useNowMinutes() {
  const read = () => {
    const d = new Date();
    return d.getHours() * 60 + d.getMinutes();
  };
  const [minutes, setMinutes] = useState(read);
  useEffect(() => {
    const id = setInterval(() => setMinutes(read()), 30_000);
    return () => clearInterval(id);
  }, []);
  return minutes;
}
