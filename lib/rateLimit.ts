/**
 * Rate limit em memória (por processo). Uso: login e criação de solicitações.
 * Em ambiente com múltiplas instâncias, considerar Redis ou similar.
 */

const store = new Map<string, number[]>();
const WINDOW_MS = 60 * 1000; // 1 minuto

function prune(key: string, windowMs: number) {
  const now = Date.now();
  const list = store.get(key) ?? [];
  const kept = list.filter((t) => now - t < windowMs);
  if (kept.length === 0) store.delete(key);
  else store.set(key, kept);
}

/**
 * Retorna true se o pedido está dentro do limite; false se excedeu (deve rejeitar).
 * @param key identificador (ex.: IP ou userId)
 * @param maxRequests máximo de requisições na janela
 * @param windowMs janela em ms (default 60s)
 */
export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number = WINDOW_MS,
): boolean {
  prune(key, windowMs);
  const list = store.get(key) ?? [];
  if (list.length >= maxRequests) return false;
  list.push(Date.now());
  store.set(key, list);
  return true;
}

export function getClientId(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const real = request.headers.get("x-real-ip");
  const ip = (forwarded ?? real ?? "127.0.0.1").split(",")[0].trim();
  return ip || "127.0.0.1";
}
