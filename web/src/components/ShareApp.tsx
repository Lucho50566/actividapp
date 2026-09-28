import { useEffect, useMemo, useState } from 'react';
import {
  X, Download, Share2, Link2, Check, Smartphone, QrCode, Copy, CircleCheck,
} from 'lucide-react';

/* ------------------------------------------------------------------ *
 *  "Compartir app": hoja que reúne todo lo necesario para llevar
 *  Actividapp a un teléfono — instalar como app (PWA) y pasar el link
 *  con un QR.
 * ------------------------------------------------------------------ */

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.matchMedia('(display-mode: fullscreen)').matches ||
  (navigator as unknown as { standalone?: boolean }).standalone === true;

function useInstall() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    setInstalled(isStandalone());
    const onPrompt = (e: Event) => { e.preventDefault(); setDeferred(e as BeforeInstallPromptEvent); };
    const onInstalled = () => { setInstalled(true); setDeferred(null); };
    window.addEventListener('beforeinstallprompt', onPrompt);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, []);

  const install = async (): Promise<boolean> => {
    if (!deferred) return false;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    return outcome === 'accepted';
  };

  return { canInstall: !!deferred, installed, install };
}

const platform = (): 'ios' | 'android' | 'desktop' => {
  const ua = navigator.userAgent;
  if (/iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && 'ontouchend' in document)) return 'ios';
  if (/Android/.test(ua)) return 'android';
  return 'desktop';
};

export function ShareApp({ onClose }: { onClose: () => void }) {
  const { canInstall, installed, install } = useInstall();
  const [justInstalled, setJustInstalled] = useState(false);
  const [qr, setQr] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const plat = useMemo(platform, []);
  const url = typeof window !== 'undefined' ? window.location.origin : '';

  useEffect(() => {
    let ok = true;
    fetch(`/api/qr?url=${encodeURIComponent(window.location.origin)}`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d: { qr?: string }) => ok && d.qr && setQr(d.qr))
      .catch(() => {});
    return () => { ok = false; };
  }, []);

  const doInstall = async () => {
    const ok = await install();
    if (ok) setJustInstalled(true);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch { /* sin permiso de portapapeles */ }
  };

  const share = async () => {
    const data = { title: 'Actividapp', text: 'Convertí capturas de actividades en ejercicios interactivos 📚', url };
    if (navigator.share) { try { await navigator.share(data); } catch { /* cancelado */ } }
    else void copy();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 animate-fade-in sm:items-center sm:p-4" onClick={onClose}>
      <div className="max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-t-3xl bg-white p-5 shadow-xl animate-slide-in dark:bg-slate-900 sm:rounded-3xl"
        onClick={(e) => e.stopPropagation()}>
        <div className="mb-1 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-lg font-bold"><Smartphone size={20} className="text-brand" />Llevá Actividapp a tu teléfono</h2>
          <button onClick={onClose} aria-label="Cerrar" className="tap grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800"><X size={18} /></button>
        </div>
        <p className="mb-4 text-sm text-slate-500">Instalala como app (ícono en la pantalla de inicio, pantalla completa y funciona sin conexión) o pasá el link.</p>

        {/* --- Instalar --- */}
        <section className="mb-4 rounded-2xl bg-brand-50/70 p-4 dark:bg-brand/10">
          {installed || justInstalled ? (
            <div className="flex items-center gap-2.5 font-medium text-green-600 dark:text-green-400">
              <CircleCheck size={22} />¡Listo! Ya está instalada en este dispositivo.</div>
          ) : canInstall ? (
            <button onClick={doInstall} className="tap flex w-full items-center justify-center gap-2 rounded-xl bg-brand py-3.5 font-semibold text-white shadow-sm shadow-brand/30">
              <Download size={19} />Instalar app
            </button>
          ) : plat === 'ios' ? (
            <div className="text-sm text-slate-600 dark:text-slate-300">
              <p className="mb-2 font-semibold text-slate-800 dark:text-slate-100">Para instalar en iPhone/iPad:</p>
              <ol className="list-decimal space-y-1 pl-5">
                <li>Tocá <b>Compartir</b> (el cuadradito con la flecha ↑) en Safari.</li>
                <li>Elegí <b>“Añadir a pantalla de inicio”</b>.</li>
                <li>Poné <b>Agregar</b>. ¡Listo! 🎉</li>
              </ol>
              <p className="mt-2 text-xs text-slate-400">Debe ser en <b>Safari</b> (en Chrome de iPhone no aparece la opción).</p>
            </div>
          ) : plat === 'android' ? (
            <div className="text-sm text-slate-600 dark:text-slate-300">
              <p className="mb-2 font-semibold text-slate-800 dark:text-slate-100">Para instalar en Android:</p>
              <ol className="list-decimal space-y-1 pl-5">
                <li>Abrí el menú <b>⋮</b> arriba a la derecha.</li>
                <li>Elegí <b>“Instalar app”</b> o <b>“Agregar a pantalla principal”</b>.</li>
              </ol>
            </div>
          ) : (
            <div className="text-sm text-slate-600 dark:text-slate-300">
              <p className="font-semibold text-slate-800 dark:text-slate-100">Instalala desde el navegador</p>
              <p className="mt-1">Buscá el ícono <Download size={14} className="inline" /> en la barra de direcciones (Chrome/Edge) o el menú <b>⋮</b> → <b>Instalar Actividapp</b>.</p>
              <p className="mt-2 text-xs text-slate-400">En el teléfono es donde mejor se ve. 📱</p>
            </div>
          )}
        </section>

        {/* --- Link + QR --- */}
        <section>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400"><QrCode size={14} />Pasar a otra persona</p>
          {qr && (
            <div className="mb-3 flex justify-center">
              <div className="rounded-2xl bg-white p-3 ring-1 ring-slate-200 dark:ring-slate-700">
                <img src={qr} alt="Código QR" className="h-44 w-44" />
              </div>
            </div>
          )}
          <div className="mb-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 p-2 pl-3 dark:border-slate-700 dark:bg-slate-800">
            <Link2 size={16} className="shrink-0 text-slate-400" />
            <span className="min-w-0 flex-1 truncate text-sm text-slate-600 dark:text-slate-300">{url}</span>
            <button onClick={copy} className="tap grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-white text-slate-500 ring-1 ring-slate-200 dark:bg-slate-900 dark:ring-slate-700" aria-label="Copiar enlace">
              {copied ? <Check size={17} className="text-green-500" /> : <Copy size={16} />}
            </button>
          </div>
          <button onClick={share} className="tap flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 py-3 font-semibold text-white dark:bg-white dark:text-slate-900">
            <Share2 size={18} />Compartir enlace
          </button>
          <p className="mt-2 text-center text-xs text-slate-400">Quien abra el link puede instalarla igual que vos.</p>
        </section>
      </div>
    </div>
  );
}
