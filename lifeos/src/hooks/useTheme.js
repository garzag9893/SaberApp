import { useEffect } from 'react';

// Aplica el tema: 'dark', 'light' o 'system' (sigue la configuración del dispositivo).
export function useTheme(theme) {
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: light)');
    const apply = () => {
      const light = theme === 'light' || (theme === 'system' && mq.matches);
      document.documentElement.classList.toggle('light', light);
      document.querySelector('meta[name="theme-color"]')?.setAttribute('content', light ? '#f3f2f8' : '#14121c');
    };
    apply();
    if (theme !== 'system') return undefined;
    mq.addEventListener('change', apply);
    return () => mq.removeEventListener('change', apply);
  }, [theme]);
}
