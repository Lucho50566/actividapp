/** Normaliza una palabra/texto para comparar: sin acentos, minúsculas y sin espacios extra. */
export const normWord = (s: string): string =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

/** Escapa un texto para usarlo dentro de una RegExp. */
export const escapeRe = (s: string): string => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
