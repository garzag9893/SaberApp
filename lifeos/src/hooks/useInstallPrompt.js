import { useState, useEffect } from 'react';

// Botón "Instalar como app" (Chrome/Edge/Android). En iPhone se instala desde Compartir.
export function useInstallPrompt(onInstalled) {
  const [prompt, setPrompt] = useState(null);

  useEffect(() => {
    const handlePrompt = (e) => {
      e.preventDefault();
      setPrompt(e);
    };
    const handleInstalled = () => {
      setPrompt(null);
      onInstalled?.();
    };
    window.addEventListener('beforeinstallprompt', handlePrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, [onInstalled]);

  const install = async () => {
    if (!prompt) return;
    prompt.prompt();
    try { await prompt.userChoice; } catch { /* el usuario cerró el diálogo */ }
    setPrompt(null);
  };

  return { canInstall: Boolean(prompt), install };
}
