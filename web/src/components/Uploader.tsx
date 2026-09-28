import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ImagePlus, Camera, Loader2, AlertCircle, RefreshCw, Settings as SettingsIcon, Check, X } from 'lucide-react';
import { api, type ProviderInfo } from '../lib/api';
import { saveActivity } from '../lib/db';

function fileToResizedDataUrl(file: File, max = 1600, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const canvas = document.createElement('canvas');
      canvas.width = w; canvas.height = h;
      const ctx = canvas.getContext('2d');
      if (!ctx) return reject(new Error('canvas'));
      ctx.drawImage(img, 0, 0, w, h);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('No se pudo leer la imagen')); };
    img.src = url;
  });
}

function makeThumb(dataUrl: string, size = 200): Promise<string> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const scale = size / Math.max(img.width, img.height);
      const w = Math.round(img.width * scale), h = Math.round(img.height * scale);
      const c = document.createElement('canvas'); c.width = w; c.height = h;
      const ctx = c.getContext('2d'); if (!ctx) return resolve(dataUrl);
      ctx.drawImage(img, 0, 0, w, h);
      resolve(c.toDataURL('image/jpeg', 0.7));
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

type Attempt = { provider: string; status: 'trying' | 'failed' | 'ok'; error?: string };

export function Uploader({ onCreated, onBack, onSettings }: {
  onCreated: (id: string) => void; onBack: () => void; onSettings: () => void;
}) {
  const [phase, setPhase] = useState<'idle' | 'processing' | 'error'>('idle');
  const [attempts, setAttempts] = useState<Attempt[]>([]);
  const [errorMsg, setErrorMsg] = useState('');
  const [preview, setPreview] = useState<string | null>(null);
  const [providers, setProviders] = useState<ProviderInfo[]>([]);
  const [selected, setSelected] = useState('');
  const [fallback, setFallback] = useState(true);
  const lastImage = useRef<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const camRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    api.getSettings().then((s) => { setProviders(s.providers); setSelected(s.activeProvider); setFallback(s.fallback); }).catch(() => {});
  }, []);

  const configured = providers.filter((p) => p.configured);
  const labelOf = (id: string) => providers.find((p) => p.id === id)?.label ?? id;

  const buildOrder = (first: string) => {
    const ids = configured.map((p) => p.id);
    const start = ids.includes(first) ? first : ids[0];
    return start ? [start, ...ids.filter((x) => x !== start)] : [];
  };

  const run = async (dataUrl: string, startProvider: string) => {
    setPhase('processing'); setErrorMsg('');
    let order = buildOrder(startProvider);
    if (!fallback) order = order.slice(0, 1);
    const log: Attempt[] = [];
    for (let i = 0; i < order.length; i++) {
      const provider = order[i]!;
      log.push({ provider, status: 'trying' });
      setAttempts([...log]);
      try {
        const { activity } = await api.interpret(dataUrl, provider, false);
        log[i]!.status = 'ok'; setAttempts([...log]);
        const now = Date.now();
        const thumb = await makeThumb(dataUrl);
        await saveActivity({ activity, answers: {}, image: dataUrl, thumb, createdAt: now, updatedAt: now });
        onCreated(activity.id);
        return;
      } catch (e) {
        log[i]!.status = 'failed'; log[i]!.error = (e as Error).message;
        setAttempts([...log]);
      }
    }
    setErrorMsg(order.length > 1 ? 'Ningún proveedor pudo interpretar la captura.' : (attempts[0]?.error ?? 'No se pudo interpretar la captura.'));
    setPhase('error');
  };

  const handleFile = async (file: File) => {
    setPhase('processing'); setErrorMsg(''); setAttempts([]);
    try {
      const dataUrl = await fileToResizedDataUrl(file);
      lastImage.current = dataUrl;
      setPreview(dataUrl);
      await run(dataUrl, selected);
    } catch (e) {
      setErrorMsg((e as Error).message ?? 'Error al leer la imagen.');
      setPhase('error');
    }
  };

  return (
    <div className="mx-auto min-h-dvh max-w-xl px-4">
      <header className="flex items-center gap-3 py-4">
        <button onClick={onBack} aria-label="Volver" className="tap grid h-10 w-10 place-items-center rounded-full bg-slate-100 dark:bg-slate-800"><ArrowLeft size={20} /></button>
        <h1 className="text-lg font-bold">Nueva actividad</h1>
      </header>

      {phase === 'processing' ? (
        <div className="mt-10 flex flex-col items-center gap-4 text-center">
          {preview && <img src={preview} alt="captura" className="max-h-52 rounded-2xl shadow-soft" />}
          <p className="text-lg font-medium">Interpretando la actividad…</p>
          <div className="w-full max-w-xs space-y-2">
            {attempts.map((a, i) => (
              <div key={i} className="flex items-center gap-2.5 rounded-xl bg-white px-3 py-2 text-left text-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800 animate-slide-in">
                {a.status === 'trying' && <Loader2 size={16} className="animate-spin text-brand" />}
                {a.status === 'ok' && <Check size={16} className="text-green-500" />}
                {a.status === 'failed' && <X size={16} className="text-red-500" />}
                <span className="flex-1 font-medium">{labelOf(a.provider)}</span>
                <span className="text-xs text-slate-400">
                  {a.status === 'trying' ? 'interpretando…' : a.status === 'ok' ? 'listo' : 'falló'}
                </span>
              </div>
            ))}
            {fallback && attempts.some((a) => a.status === 'failed') && attempts[attempts.length - 1]?.status === 'trying' && (
              <p className="text-xs text-amber-500">Falló, cambiando de proveedor automáticamente…</p>
            )}
          </div>
        </div>
      ) : (
        <>
          <p className="mb-4 mt-2 text-slate-500">
            Subí o sacá una foto de la actividad del libro. La IA la convierte en ejercicios que podés resolver acá.
          </p>

          {configured.length > 0 ? (
            <div className="mb-4">
              <div className="mb-1.5 flex items-center justify-between">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Interpretar con</p>
                {fallback && <span className="text-xs text-slate-400">↔ cambia solo si falla</span>}
              </div>
              <div className="flex flex-wrap gap-2">
                {configured.map((p) => (
                  <button key={p.id} onClick={() => setSelected(p.id)}
                    className={`tap rounded-full px-3.5 py-1.5 text-sm font-medium transition-all ${selected === p.id ? 'bg-brand text-white' : 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300'}`}>
                    {p.label}
                  </button>
                ))}
                <button onClick={onSettings} className="tap inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-sm text-slate-400"><SettingsIcon size={14} />configurar</button>
              </div>
            </div>
          ) : (
            <button onClick={onSettings} className="mb-4 flex w-full items-center gap-2 rounded-2xl bg-amber-50 p-3 text-left text-sm text-amber-700 dark:bg-amber-900/20 dark:text-amber-400">
              <AlertCircle size={18} className="shrink-0" />No hay ninguna IA configurada. Tocá para agregar una API key.
            </button>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button onClick={() => camRef.current?.click()}
              className="tap flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-slate-300 bg-white p-8 transition-all duration-150 hover:border-brand hover:bg-brand-50/50 hover:shadow-soft dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-brand/10">
              <Camera size={36} className="text-brand" /><span className="font-semibold">Tomar foto</span>
            </button>
            <button onClick={() => fileRef.current?.click()}
              className="tap flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-slate-300 bg-white p-8 transition-all duration-150 hover:border-brand hover:bg-brand-50/50 hover:shadow-soft dark:border-slate-700 dark:bg-slate-900 dark:hover:bg-brand/10">
              <ImagePlus size={36} className="text-brand" /><span className="font-semibold">Subir captura</span>
            </button>
          </div>

          {errorMsg && (
            <div className="mt-5 rounded-2xl bg-red-50 p-3 dark:bg-red-900/20">
              <div className="flex items-start gap-2 text-red-600"><AlertCircle size={20} className="mt-0.5 shrink-0" /><span className="text-sm">{errorMsg}</span></div>
              {attempts.filter((a) => a.status === 'failed').map((a, i) => (
                <p key={i} className="mt-1 pl-7 text-xs text-slate-500">{labelOf(a.provider)}: {a.error}</p>
              ))}
              {lastImage.current && configured.length > 0 && (
                <div className="mt-3">
                  <p className="mb-1.5 text-xs font-medium text-slate-500">Reintentar con:</p>
                  <div className="flex flex-wrap gap-2">
                    {configured.map((p) => (
                      <button key={p.id} onClick={() => { setSelected(p.id); void run(lastImage.current!, p.id); }}
                        className="tap inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-sm font-medium text-brand ring-1 ring-brand/30 dark:bg-slate-900"><RefreshCw size={13} />{p.label}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <input ref={camRef} type="file" accept="image/*" capture="environment" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ''; }} />
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleFile(f); e.target.value = ''; }} />
        </>
      )}
    </div>
  );
}
