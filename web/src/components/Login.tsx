import { useState } from 'react';
import { BookOpen, Loader2, Mail, Lock, LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '../lib/auth';

export function Login() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'in' | 'up'>('in');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true); setError(''); setInfo('');
    try {
      if (mode === 'in') await signIn(email, password);
      else {
        const { needsConfirm } = await signUp(email, password);
        if (needsConfirm) setInfo('¡Cuenta creada! Revisá tu email para confirmarla y después iniciá sesión.');
      }
    } catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  };

  return (
    <div className="grid min-h-dvh place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-6 flex flex-col items-center text-center">
          <span className="mb-3 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-brand to-brand-500 text-white shadow-lg shadow-brand/30"><BookOpen size={30} /></span>
          <h1 className="text-2xl font-extrabold">Actividapp</h1>
          <p className="mt-1 text-sm text-slate-500">{mode === 'in' ? 'Iniciá sesión para continuar' : 'Creá tu cuenta'}</p>
        </div>

        <form onSubmit={submit} className="rounded-2xl bg-white p-5 ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Email</label>
          <div className="relative mb-3">
            <Mail size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)}
              placeholder="tucorreo@ejemplo.com" className="answer-input !pl-9" />
          </div>
          <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-slate-400">Contraseña</label>
          <div className="relative">
            <Lock size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input type="password" autoComplete={mode === 'in' ? 'current-password' : 'new-password'} required minLength={6}
              value={password} onChange={(e) => setPassword(e.target.value)} placeholder="••••••••" className="answer-input !pl-9" />
          </div>

          {error && <p className="mt-3 rounded-xl bg-red-50 p-2.5 text-sm text-red-600 dark:bg-red-900/20 dark:text-red-400">{error}</p>}
          {info && <p className="mt-3 rounded-xl bg-green-50 p-2.5 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">{info}</p>}

          <button type="submit" disabled={busy || !email || password.length < 6}
            className="tap mt-4 flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3 font-semibold text-white disabled:opacity-50">
            {busy ? <Loader2 size={18} className="animate-spin" /> : mode === 'in' ? <LogIn size={18} /> : <UserPlus size={18} />}
            {mode === 'in' ? 'Entrar' : 'Crear cuenta'}
          </button>
        </form>

        <button onClick={() => { setMode(mode === 'in' ? 'up' : 'in'); setError(''); setInfo(''); }}
          className="tap mx-auto mt-4 block text-sm text-slate-500">
          {mode === 'in' ? <>¿No tenés cuenta? <span className="font-semibold text-brand">Crear una</span></> : <>¿Ya tenés cuenta? <span className="font-semibold text-brand">Iniciar sesión</span></>}
        </button>
      </div>
    </div>
  );
}
