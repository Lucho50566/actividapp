import type { ReactNode } from 'react';
import { Loader2, ShieldAlert, LogOut, RefreshCw } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { Login } from './Login';

const Spinner = () => (
  <div className="grid min-h-dvh place-items-center text-slate-400"><Loader2 className="h-8 w-8 animate-spin" /></div>
);

/** Puerta de acceso: sin login habilitado → pasa directo; si no, exige sesión + acceso pagado. */
export function AuthGate({ children }: { children: ReactNode }) {
  const { authEnabled, status, email, notice, signOut, recheck } = useAuth();

  if (!authEnabled) return <>{children}</>;
  if (status === 'loading') return <Spinner />;
  if (status === 'signed_out') return <Login />;

  if (status === 'pending') {
    return (
      <div className="grid min-h-dvh place-items-center px-4">
        <div className="w-full max-w-sm text-center">
          <span className="mx-auto mb-4 grid h-16 w-16 place-items-center rounded-2xl bg-amber-100 text-amber-600 dark:bg-amber-900/30"><ShieldAlert size={30} /></span>
          <h1 className="text-xl font-extrabold">Acceso pendiente</h1>
          <p className="mt-2 text-sm text-slate-500">{notice}</p>
          {email && <p className="mt-1 text-xs text-slate-400">Sesión: {email}</p>}
          <div className="mt-5 flex flex-col gap-2">
            <button onClick={recheck} className="tap flex items-center justify-center gap-2 rounded-xl bg-brand py-3 font-semibold text-white"><RefreshCw size={18} />Ya me habilitaron, reintentar</button>
            <button onClick={signOut} className="tap flex items-center justify-center gap-2 rounded-xl bg-slate-100 py-3 font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300"><LogOut size={18} />Cerrar sesión</button>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
