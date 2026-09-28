import { lazy, Suspense, useEffect, useState } from 'react';
import { Home } from './components/Home';
import { getActivity, type StoredActivity } from './lib/db';

// Code-splitting por ruta: Home es la landing (eager); el resto se carga on-demand.
const Uploader = lazy(() => import('./components/Uploader').then((m) => ({ default: m.Uploader })));
const ActivityView = lazy(() => import('./components/ActivityView').then((m) => ({ default: m.ActivityView })));
const Settings = lazy(() => import('./components/Settings').then((m) => ({ default: m.Settings })));

const Spinner = () => (
  <div className="grid min-h-dvh place-items-center text-slate-400">
    <span className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-brand" />
  </div>
);

type Route =
  | { name: 'home' }
  | { name: 'upload' }
  | { name: 'settings' }
  | { name: 'activity'; id: string };

export function App() {
  const [route, setRoute] = useState<Route>({ name: 'home' });
  const [current, setCurrent] = useState<StoredActivity | null>(null);
  const [loading, setLoading] = useState(false);

  // Prefetch en idle de las rutas lazy: la navegación se siente instantánea sin
  // engordar el arranque (los chunks se descargan cuando el hilo está libre).
  useEffect(() => {
    const idle = (cb: () => void) =>
      ('requestIdleCallback' in window
        ? (window as unknown as { requestIdleCallback: (cb: () => void) => void }).requestIdleCallback(cb)
        : setTimeout(cb, 1500));
    idle(() => { void import('./components/Uploader'); void import('./components/ActivityView'); });
  }, []);

  useEffect(() => {
    if (route.name !== 'activity') { setCurrent(null); return; }
    let ok = true;
    setLoading(true);
    getActivity(route.id).then((s) => {
      if (!ok) return;
      setCurrent(s ?? null);
      setLoading(false);
    });
    return () => { ok = false; };
  }, [route]);

  if (route.name === 'home') {
    return <Home onNew={() => setRoute({ name: 'upload' })} onOpen={(id) => setRoute({ name: 'activity', id })} onSettings={() => setRoute({ name: 'settings' })} />;
  }
  return (
    <Suspense fallback={<Spinner />}>
      {route.name === 'upload' && (
        <Uploader onBack={() => setRoute({ name: 'home' })} onCreated={(id) => setRoute({ name: 'activity', id })} onSettings={() => setRoute({ name: 'settings' })} />
      )}
      {route.name === 'settings' && <Settings onBack={() => setRoute({ name: 'home' })} />}
      {route.name === 'activity' && (
        loading ? <Spinner />
          : !current ? (
            <div className="grid min-h-dvh place-items-center gap-3 text-center text-slate-400">
              <p>No se encontró la actividad.</p>
              <button onClick={() => setRoute({ name: 'home' })} className="rounded-xl bg-brand px-4 py-2 text-white">Volver</button>
            </div>
          ) : <ActivityView stored={current} onBack={() => setRoute({ name: 'home' })} />
      )}
    </Suspense>
  );
}
