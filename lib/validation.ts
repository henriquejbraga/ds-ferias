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

export function buildInclusiveOverlapConditions(startDate: Date, endDate: Date) {
  return [{ startDate: { lte: endDate } }, { endDate: { gte: startDate } }];
}

type DateRange = { start: Date; end: Date };

export function hasInternalOverlapInDateRanges(ranges: DateRange[]): boolean {
  if (ranges.length <= 1) return false;

  const normalized = ranges
    .map(({ start, end }) => ({ start: start.getTime(), end: end.getTime() }))
    .sort((a, b) => a.start - b.start);

  for (let i = 1; i < normalized.length; i += 1) {
    if (normalized[i].start <= normalized[i - 1].end) {
      return true;
    }
  }

  return false;
}

/**
 * Sanitiza texto removendo tags HTML básicas para prevenir XSS persistente.
 */
export function sanitizeText(text: unknown): string | null {
  if (typeof text !== "string") return null;
  // Remove tags HTML
  return text.replace(/<[^>]*>?/gm, "").trim() || null;
}
