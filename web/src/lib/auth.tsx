import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, authEnabled, LICENSE_TABLE } from './supabase';

// signed_out: sin sesión · pending: logueado pero sin acceso pagado · ok: habilitado
export type AuthStatus = 'loading' | 'signed_out' | 'pending' | 'ok';

interface AuthCtx {
  authEnabled: boolean;
  status: AuthStatus;
  email: string | null;
  notice: string;                 // motivo del bloqueo (para la pantalla "pending")
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ needsConfirm: boolean }>;
  signOut: () => Promise<void>;
  recheck: () => void;
}

const Ctx = createContext<AuthCtx>(null!);
export const useAuth = () => useContext(Ctx);

/** Verifica en la tabla de licencias si el usuario tiene acceso pagado y vigente. */
async function checkLicense(userId: string): Promise<{ ok: boolean; notice: string }> {
  if (!supabase) return { ok: false, notice: '' };
  const { data, error } = await supabase.from(LICENSE_TABLE).select('active, expires_at').eq('user_id', userId).maybeSingle();
  if (error) return { ok: false, notice: 'No pudimos verificar tu acceso. Reintentá en un momento.' };
  if (!data || !data.active) return { ok: false, notice: 'Tu cuenta todavía no está habilitada. Escribinos para activar tu acceso.' };
  if (data.expires_at && new Date(data.expires_at as string).getTime() < Date.now()) return { ok: false, notice: 'Tu acceso venció. Renovalo para seguir usando la app.' };
  return { ok: true, notice: '' };
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AuthStatus>(authEnabled ? 'loading' : 'ok');
  const [email, setEmail] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const session = useRef<Session | null>(null);

  const resolve = useCallback(async (s: Session | null) => {
    session.current = s;
    if (!s) { setEmail(null); setStatus('signed_out'); return; }
    setEmail(s.user.email ?? null);
    const { ok, notice } = await checkLicense(s.user.id);
    setNotice(notice);
    setStatus(ok ? 'ok' : 'pending');
  }, []);

  useEffect(() => {
    if (!authEnabled || !supabase) return;
    let alive = true;
    supabase.auth.getSession().then(({ data }) => { if (alive) void resolve(data.session); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { if (alive) void resolve(s); });

    // Re-chequeo de acceso: al volver a la pestaña y cada 5 min. Si revocás el acceso, se bloquea.
    const revalidate = () => { if (session.current) void resolve(session.current); };
    const onVis = () => { if (document.visibilityState === 'visible') revalidate(); };
    document.addEventListener('visibilitychange', onVis);
    const iv = setInterval(revalidate, 5 * 60 * 1000);

    return () => { alive = false; sub.subscription.unsubscribe(); document.removeEventListener('visibilitychange', onVis); clearInterval(iv); };
  }, [resolve]);

  const signIn = useCallback(async (mail: string, password: string) => {
    if (!supabase) throw new Error('Login no configurado');
    const { error } = await supabase.auth.signInWithPassword({ email: mail.trim(), password });
    if (error) throw new Error(translate(error.message));
  }, []);

  const signUp = useCallback(async (mail: string, password: string) => {
    if (!supabase) throw new Error('Login no configurado');
    const { data, error } = await supabase.auth.signUp({ email: mail.trim(), password });
    if (error) throw new Error(translate(error.message));
    return { needsConfirm: !data.session }; // sin sesión = requiere confirmar email
  }, []);

  const signOut = useCallback(async () => { await supabase?.auth.signOut(); }, []);
  const recheck = useCallback(() => { if (session.current) void resolve(session.current); }, [resolve]);

  return (
    <Ctx.Provider value={{ authEnabled, status, email, notice, signIn, signUp, signOut, recheck }}>
      {children}
    </Ctx.Provider>
  );
}

// Traduce los errores más comunes de Supabase al español.
function translate(msg: string): string {
  const m = msg.toLowerCase();
  if (m.includes('invalid login')) return 'Email o contraseña incorrectos.';
  if (m.includes('already registered')) return 'Ese email ya tiene una cuenta. Iniciá sesión.';
  if (m.includes('password') && m.includes('6')) return 'La contraseña debe tener al menos 6 caracteres.';
  if (m.includes('email') && m.includes('valid')) return 'Ingresá un email válido.';
  if (m.includes('rate limit')) return 'Demasiados intentos. Esperá un momento.';
  return msg;
}
