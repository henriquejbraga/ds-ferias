/**
 * Validação de IDs usados nas rotas dinâmicas (Prisma usa CUID).
 * Evita consultas desnecessárias ao banco com IDs malformados e melhora mensagens de erro.
 */

/** CUID (v1) tem 25 caracteres e começa com 'c'; CUID2 varia. Aceitamos formato compatível com Prisma. */
const CUID_REGEX = /^[a-zA-Z0-9]{20,30}$/;

export function isCuid(id: unknown): id is string {
  return typeof id === "string" && id.length > 0 && CUID_REGEX.test(id);
}

export function requireCuid(id: unknown): string | null {
  return isCuid(id) ? id : null;
}
