import type { Activity } from '@actividapp/shared';

/** Actividad de ejemplo para probar la UI sin API key (modo demo). */
export function demoActivity(): Activity {
  return {
    id: 'demo',
    title: 'Actividad de ejemplo',
    subject: 'Demostración',
    createdAt: Date.now(),
    blocks: [
      { type: 'heading', id: 'b1', text: 'Actividad 1 — Ejemplo' },
      { type: 'paragraph', id: 'b2', text: 'Esta es una actividad de muestra. Cargá una captura real para generar la tuya.' },
      { type: 'fill_blank', id: 'b3', prompt: 'La capital de Argentina es ____ y la de Uruguay es ____.' },
      {
        type: 'multiple_choice', id: 'b4', prompt: '¿Cuál de estos es un planeta?', multiple: false,
        options: [
          { id: 'o1', text: 'La Luna' },
          { id: 'o2', text: 'Marte' },
          { id: 'o3', text: 'El Sol' },
        ],
      },
      {
        type: 'true_false', id: 'b5', prompt: 'Indicá si es Verdadero o Falso',
        statements: [
          { id: 's1', text: 'El agua hierve a 100 °C a nivel del mar.' },
          { id: 's2', text: 'Los peces son mamíferos.' },
        ],
      },
      {
        type: 'matching', id: 'b6', prompt: 'Uní cada país con su capital',
        left: [{ id: 'l1', text: 'Argentina' }, { id: 'l2', text: 'Brasil' }, { id: 'l3', text: 'Chile' }],
        right: [{ id: 'r1', text: 'Santiago' }, { id: 'r2', text: 'Buenos Aires' }, { id: 'r3', text: 'Brasilia' }],
      },
      { type: 'open', id: 'b7', prompt: 'Escribí una reflexión sobre lo aprendido.', lines: 4 },
    ],
  };
}
