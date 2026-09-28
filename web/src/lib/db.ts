import { get, set, del, keys } from 'idb-keyval';
import type { Activity, Answers } from '@actividapp/shared';

export interface StoredActivity {
  activity: Activity;
  answers: Answers;
  image?: string;  // dataURL de la captura original (opcional)
  thumb?: string;  // miniatura chica para el listado
  createdAt: number;
  updatedAt: number;
}

export interface ActivitySummary {
  id: string;
  title: string;
  subject?: string;
  thumb?: string;
  createdAt: number;
  updatedAt: number;
}

const PREFIX = 'act:';

export async function listActivities(): Promise<ActivitySummary[]> {
  const allKeys = (await keys()).filter((k): k is string => typeof k === 'string' && k.startsWith(PREFIX));
  const items = await Promise.all(allKeys.map((k) => get<StoredActivity>(k)));
  return items
    .filter((x): x is StoredActivity => !!x)
    .map((s) => ({ id: s.activity.id, title: s.activity.title, subject: s.activity.subject, thumb: s.thumb ?? s.image, createdAt: s.createdAt, updatedAt: s.updatedAt }))
    .sort((a, b) => b.updatedAt - a.updatedAt);
}

export const getActivity = (id: string) => get<StoredActivity>(PREFIX + id);

export async function saveActivity(stored: StoredActivity): Promise<void> {
  await set(PREFIX + stored.activity.id, stored);
}

export async function saveAnswers(id: string, answers: Answers): Promise<void> {
  const s = await getActivity(id);
  if (!s) return;
  await set(PREFIX + id, { ...s, answers, updatedAt: Date.now() });
}

/** Guarda la actividad editada (correcciones de bloques/título/materia). */
export async function saveActivityData(id: string, activity: Activity): Promise<void> {
  const s = await getActivity(id);
  if (!s) return;
  await set(PREFIX + id, { ...s, activity, updatedAt: Date.now() });
}

export const deleteActivity = (id: string) => del(PREFIX + id);

/** Borra TODAS las actividades guardadas. */
export async function clearAllActivities(): Promise<number> {
  const allKeys = (await keys()).filter((k): k is string => typeof k === 'string' && k.startsWith(PREFIX));
  await Promise.all(allKeys.map((k) => del(k)));
  return allKeys.length;
}
