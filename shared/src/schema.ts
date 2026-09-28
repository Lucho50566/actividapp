import { z } from 'zod';

/**
 * Esquema de una "Actividad": el resultado de interpretar una captura.
 * La IA de visión debe devolver un objeto que valide contra `activitySchema`.
 * El frontend renderiza una interfaz interactiva a partir de estos bloques.
 */

const optionSchema = z.object({
  id: z.string(),
  text: z.string(),
});

// Marca de hueco para completar: en `prompt` se usan "____" (4+ guiones bajos).
export const BLANK_TOKEN = /_{3,}/g;

const headingBlock = z.object({
  type: z.literal('heading'),
  id: z.string(),
  text: z.string(),
});

const paragraphBlock = z.object({
  type: z.literal('paragraph'),
  id: z.string(),
  text: z.string(),
});

const fillBlank = z.object({
  type: z.literal('fill_blank'),
  id: z.string(),
  prompt: z.string(), // contiene "____" por cada hueco
});

const openBlock = z.object({
  type: z.literal('open'),
  id: z.string(),
  prompt: z.string(),
  lines: z.number().int().min(1).max(20).optional(),
});

const multipleChoice = z.object({
  type: z.literal('multiple_choice'),
  id: z.string(),
  prompt: z.string(),
  options: z.array(optionSchema).min(2),
  multiple: z.boolean().optional(),
});

const trueFalse = z.object({
  type: z.literal('true_false'),
  id: z.string(),
  prompt: z.string().optional(),
  statements: z.array(optionSchema).min(1),
});

const matching = z.object({
  type: z.literal('matching'),
  id: z.string(),
  prompt: z.string().optional(),
  left: z.array(optionSchema).min(1),
  right: z.array(optionSchema).min(1),
});

// Imagen/figura de la actividad que hay que ver. `box` = recorte normalizado (0..1)
// dentro de la captura original: x,y = esquina sup-izq, w,h = ancho/alto (fracciones).
export const imageBox = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  w: z.number().min(0).max(1),
  h: z.number().min(0).max(1),
});
const imageBlock = z.object({
  type: z.literal('image'),
  id: z.string(),
  box: imageBox.optional(),
  caption: z.string().optional(),
});

// Banco de palabras: cuadro con las palabras que hay que usar en la actividad.
const wordBank = z.object({
  type: z.literal('word_bank'),
  id: z.string(),
  title: z.string().optional(),
  words: z.array(z.string()).min(1),
});

export const blockSchema = z.discriminatedUnion('type', [
  headingBlock, paragraphBlock, fillBlank, openBlock, multipleChoice, trueFalse, matching, imageBlock, wordBank,
]);

export const activitySchema = z.object({
  id: z.string(),
  title: z.string(),
  subject: z.string().optional(),
  createdAt: z.number(),
  blocks: z.array(blockSchema),
});

// Lo que devuelve la IA (sin id/createdAt: los pone el servidor)
export const aiActivitySchema = z.object({
  title: z.string().default('Actividad'),
  subject: z.string().optional(),
  blocks: z.array(blockSchema.or(z.record(z.unknown()))), // tolerante; se limpia luego
});

export type Block = z.infer<typeof blockSchema>;
export type Activity = z.infer<typeof activitySchema>;
export type BlockType = Block['type'];
export type Option = z.infer<typeof optionSchema>;

export const BLOCK_TYPES: BlockType[] = [
  'heading', 'paragraph', 'fill_blank', 'open', 'multiple_choice', 'true_false', 'matching', 'image', 'word_bank',
];

/** Cuenta los huecos "____" de un texto. */
export function countBlanks(prompt: string): number {
  const m = prompt.match(BLANK_TOKEN);
  return m ? m.length : 0;
}
