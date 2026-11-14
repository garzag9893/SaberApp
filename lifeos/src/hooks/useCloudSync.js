import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  CLOUD_ENABLED, loadSession, saveSession, signIn, signUp, signOut,
  freshSession, pullPayload, pushPayload, isAuthError,
} from '../lib/cloud.js';
import { normalizeRemote } from '../lib/storage.js';
import { mergeData, stableStringify } from '../lib/merge.js';

// Sincronización con Supabase: descarga, fusiona con lo local (elemento por elemento) y sube el resultado.
export function useCloudSync({ data, dataRef, applyRemote, showToast }) {
  const [session, setSession] = useState(() => (CLOUD_ENABLED ? loadSession() : null));
  const [status, setStatus] = useState(!CLOUD_ENABLED ? 'local' : session ? 'syncing' : 'signedout');
  const [showLogin, setShowLogin] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);

  const sessionRef = useRef(session);
  sessionRef.current = session;
  const lastSyncedRef = useRef(null); // copia de lo que coincide con la nube
  const busyRef = useRef(false);
  const againRef = useRef(false);

  const updateSession = useCallback((next) => {
    saveSession(next);
    sessionRef.current = next;
    setSession(next);
    if (!next) {
      lastSyncedRef.current = null;
      setStatus(CLOUD_ENABLED ? 'signedout' : 'local');
    }
  }, []);

  const sync = useCallback(async () => {
    if (!CLOUD_ENABLED || !sessionRef.current) return;
    if (busyRef.current) {
      againRef.current = true;
      return;
    }
    busyRef.current = true;
    setStatus('syncing');
    try {
      let active = sessionRef.current;
      const fresh = await freshSession(active);
      if (fresh !== active) {
        updateSession(fresh);
        active = fresh;
      }
      const remote = normalizeRemote(await pullPayload(active));
      const local = dataRef.current;
      const merged = remote ? mergeData(local, remote) : local;
      const mergedJson = stableStringify(merged);
      if (remote && mergedJson !== stableStringify(local)) applyRemote(remote);
      if (!remote || mergedJson !== stableStringify(remote)) {
        await pushPayload(active, { ...merged, updatedAt: new Date().toISOString() });
      }
      lastSyncedRef.current = mergedJson;
      setStatus('synced');
    } catch (err) {
      if (isAuthError(err)) {
        updateSession(null);
        showToast('🔒 Tu sesión venció. Vuelve a entrar para sincronizar.');
      } else {
        setStatus('error');
      }
    } finally {
      busyRef.current = false;
      if (againRef.current) {
        againRef.current = false;
        setTimeout(() => sync(), 0);
      }
    }
  }, [dataRef, applyRemote, showToast, updateSession]);

  // Sube los cambios locales un momento después de editarlos.
  const userId = session?.userId;
  const dataJson = useMemo(() => (CLOUD_ENABLED && userId ? stableStringify(data) : ''), [data, userId]);
  useEffect(() => {
    if (!CLOUD_ENABLED || !userId || lastSyncedRef.current === dataJson) return undefined;
    const timer = setTimeout(sync, lastSyncedRef.current === null ? 0 : 1500);
    return () => clearTimeout(timer);
  }, [dataJson, userId, sync]);

  // Al volver a la pestaña o recuperar la conexión, trae lo nuevo de otros dispositivos.
  useEffect(() => {
    if (!CLOUD_ENABLED) return undefined;
    const retry = () => {
      if (document.visibilityState === 'visible') sync();
    };
    document.addEventListener('visibilitychange', retry);
    window.addEventListener('online', retry);
    return () => {
      document.removeEventListener('visibilitychange', retry);
      window.removeEventListener('online', retry);
    };
  }, [sync]);

  const authenticate = async (mode, email, password) => {
    if (!email.trim() || password.length < 6) {
      showToast('⚠️ Escribe tu correo y una contraseña de al menos 6 caracteres');
      return false;
    }
    setAuthBusy(true);
    try {
      const next = mode === 'signup' ? await signUp(email.trim(), password) : await signIn(email.trim(), password);
      if (!next) {
        showToast('📧 Cuenta creada. Confirma tu correo y después inicia sesión.');
        return false;
      }
      lastSyncedRef.current = null;
      updateSession(next);
      setShowLogin(false);
      showToast('☁️ Sesión iniciada. Sincronizando…');
      return true;
    } catch (err) {
      showToast(`❌ ${err.message || 'No se pudo iniciar sesión'}`);
      return false;
    } finally {
      setAuthBusy(false);
    }
  };

  const logout = () => {
    const current = sessionRef.current;
    updateSession(null);
    if (current) signOut(current);
    showToast('👋 Sesión cerrada. Tus datos siguen guardados en este dispositivo.');
  };

  return {
    enabled: CLOUD_ENABLED, session, status, showLogin, setShowLogin, authBusy,
    authenticate, logout, retry: sync,
  };
}
