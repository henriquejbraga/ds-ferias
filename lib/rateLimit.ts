import { logger } from "./logger";

/**
 * Memória volátil para rate limit básico em Route Handlers.
 * Em produção (serverless), este mapa é resetado a cada cold start,
 * mas serve como proteção primária contra abusos.
 */
const rateLimitMap = new Map<string, { count: number; reset: number }>();

/**
 * Obtém um identificador único para o cliente (IP).
 */
export function getClientId(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  
  return "127.0.0.1";
}

/**
 * Verifica se um cliente atingiu o limite de requisições.
 */
export function checkRateLimit(key: string, limit = 50, windowMs = 60000): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(key);

  if (!entry || now > entry.reset) {
    rateLimitMap.set(key, { count: 1, reset: now + windowMs });
    return true;
  }

  if (entry.count >= limit) {
    logger.warn("Rate limit triggered", { 
      key, 
      limit, 
      count: entry.count + 1 
    });
    return false;
  }

  entry.count++;
  return true;
}

/**
 * Alias para compatibilidade ou uso simplificado.
 */
export function rateLimit(ip: string, limit = 50, windowMs = 60000) {
  const success = checkRateLimit(ip, limit, windowMs);
  return { success, remaining: 0 };
}
