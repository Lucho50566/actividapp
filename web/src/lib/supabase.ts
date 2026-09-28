import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// Config inyectada en build (Vite). Si falta, la app corre SIN login (modo abierto/dev).
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

/** ¿Hay login habilitado? Solo si están las dos variables de entorno. */
export const authEnabled = !!(url && anonKey);

/**
 * Nombre de la tabla que decide quién tiene acceso pagado.
 * Debe tener: user_id (uuid, = auth.uid()), active (bool), expires_at (timestamptz, opcional).
 */
export const LICENSE_TABLE = (import.meta.env.VITE_LICENSE_TABLE as string) || 'licenses';

export const supabase: SupabaseClient | null = authEnabled
  ? createClient(url!, anonKey!, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
    })
  : null;
