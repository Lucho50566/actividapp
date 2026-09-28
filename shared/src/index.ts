export * from './schema.js';
export * from './text.js';

/** Respuestas del usuario, indexadas por id de bloque. Forma según el tipo:
 *  - fill_blank: string[]           (una por hueco)
 *  - open:       string
 *  - multiple_choice: string[]      (ids de opción seleccionadas)
 *  - true_false: Record<string,'true'|'false'>  (por statement id)
 *  - matching:   Record<string,string>          (leftId -> rightId)
 */
export type Answers = Record<string, unknown>;
