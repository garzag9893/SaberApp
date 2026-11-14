// Cliente mínimo de Supabase (Auth + REST) sin dependencias.
// Cada usuario inicia sesión y solo puede leer y escribir su propia fila (ver RLS en el README).

const env = import.meta.env || {};
const SESSION_KEY = 'lifeos_session_v5';

export const CLOUD_CONFIG = {
  url: (env.VITE_SUPABASE_URL || '').replace(/\/+$/, ''),
  anonKey: env.VITE_SUPABASE_ANON_KEY || '',
};
export const CLOUD_ENABLED = Boolean(CLOUD_CONFIG.url && CLOUD_CONFIG.anonKey);

async function request(path, { method = 'GET', token, body, headers, signal } = {}) {
  const res = await fetch(`${CLOUD_CONFIG.url}${path}`, {
    method,
    signal,
    headers: {
      apikey: CLOUD_CONFIG.anonKey,
      Authorization: `Bearer ${token || CLOUD_CONFIG.anonKey}`,
      'Content-Type': 'application/json',
      ...headers,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = null;
  }

  // fetch no lanza error con 401/404/500: hay que revisar el estado.
  if (!res.ok) {
    const err = new Error(data?.error_description || data?.msg || data?.message || `Error ${res.status}`);
    err.status = res.status;
    throw err;
  }
  return data;
}

const toSession = (data) =>
  data?.access_token && data?.user?.id
    ? {
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresAt: Date.now() + (data.expires_in || 3600) * 1000,
        userId: data.user.id,
        email: data.user.email || '',
      }
    : null;

export const loadSession = () => {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY));
    return s?.accessToken && s?.refreshToken && s?.userId ? s : null;
  } catch {
    return null;
  }
};

export const saveSession = (session) => {
  try {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // Sin almacenamiento la sesión dura solo mientras la pestaña esté abierta.
  }
};

export async function signIn(email, password) {
  const session = toSession(
    await request('/auth/v1/token?grant_type=password', { method: 'POST', body: { email, password } })
  );
  if (!session) throw new Error('Respuesta de inicio de sesión inválida');
  return session;
}

// Devuelve null cuando Supabase exige confirmar el correo antes de entrar.
export async function signUp(email, password) {
  return toSession(await request('/auth/v1/signup', { method: 'POST', body: { email, password } }));
}

export async function signOut(session) {
  try {
    await request('/auth/v1/logout', { method: 'POST', token: session.accessToken });
  } catch {
    // La sesión local se borra de todos modos.
  }
}

// Renueva el token si está por vencer. Devuelve la misma sesión si sigue vigente.
export async function freshSession(session, signal) {
  if (session.expiresAt - 60_000 > Date.now()) return session;
  let renewed = null;
  try {
    renewed = toSession(
      await request('/auth/v1/token?grant_type=refresh_token', {
        method: 'POST',
        body: { refresh_token: session.refreshToken },
        signal,
      })
    );
  } catch (err) {
    // Supabase responde 400 cuando el token de renovación ya no es válido.
    if (err.status >= 400 && err.status < 500) err.status = 401;
    throw err;
  }
  if (!renewed) {
    const err = new Error('No se pudo renovar la sesión');
    err.status = 401;
    throw err;
  }
  return renewed;
}

export async function pullPayload(session, signal) {
  const rows = await request(
    `/rest/v1/lifeos_data?id=eq.${encodeURIComponent(session.userId)}&select=payload`,
    { token: session.accessToken, signal }
  );
  return rows?.[0]?.payload ?? null;
}

export async function pushPayload(session, payload, signal) {
  await request('/rest/v1/lifeos_data', {
    method: 'POST',
    token: session.accessToken,
    signal,
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: { id: session.userId, payload },
  });
}

// La sesión ya no sirve (token inválido o revocado): hay que volver a entrar.
export const isAuthError = (err) => err?.status === 401;
