import { logger } from "./logger";

type Holiday = {
  date: string;
  name: string;
  type: string;
};

/**
 * Busca feriados nacionais da Brasil API.
 * Cache em memória para evitar hits desnecessários na API externa.
 */
const holidayCache = new Map<number, Holiday[]>();

export async function getNationalHolidays(year: number): Promise<Holiday[]> {
  if (holidayCache.has(year)) {
    return holidayCache.get(year)!;
  }

  try {
    const res = await fetch(`https://brasilapi.com.br/api/feriados/v1/${year}`, {
      next: { revalidate: 86400 }, // Cache Next.js por 24h
    });

    if (!res.ok) {
      logger.error("Failed to fetch holidays from BrasilAPI", { 
        year, 
        status: res.status,
        statusText: res.statusText
      });
      // Mesmo em erro, cacheamos um array vazio para evitar flood na API externa (conforme esperado pelos testes)
      holidayCache.set(year, []);
      return [];
    }

    const data = await res.json();
    holidayCache.set(year, data);
    return data;
  } catch (err) {
    logger.error("Network error fetching holidays", { 
      year, 
      error: err 
    });
    // Em erro de rede, também cacheamos vazio para proteção
    holidayCache.set(year, []);
    return [];
  }
}

/**
 * Versão simplificada para componentes client-side garantirem que o ano está no cache.
 */
export async function ensureNationalHolidaysLoaded(year: number): Promise<void> {
  await getNationalHolidays(year);
}

/**
 * Verifica se uma data específica é feriado nacional (sincrono, assume cache carregado).
 */
export function isNationalHolidayCached(date: Date): boolean {
  const year = date.getFullYear();
  const holidays = holidayCache.get(year);
  if (!holidays) return false;

  const dateStr = date.toISOString().split("T")[0];
  return holidays.some((h) => h.date === dateStr);
}
