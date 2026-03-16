const HOLIDAY_API_BASE = "https://brasilapi.com.br/api/feriados/v1";

type HolidayApiItem = {
  date: string; // YYYY-MM-DD
  name: string;
  type?: string;
};

type YearCache = {
  dates: Set<string>;
  loaded: boolean;
};

const nationalHolidaysCache = new Map<number, YearCache>();

function getYearCache(year: number): YearCache {
  let cache = nationalHolidaysCache.get(year);
  if (!cache) {
    cache = { dates: new Set<string>(), loaded: false };
    nationalHolidaysCache.set(year, cache);
  }
  return cache;
}

export async function ensureNationalHolidaysLoaded(year: number): Promise<void> {
  const cache = getYearCache(year);
  if (cache.loaded) return;

  // Em ambiente de teste, não bate na API externa para manter os testes determinísticos.
  if (process.env.NODE_ENV === "test") {
    cache.loaded = true;
    return;
  }

  try {
    const res = await fetch(`${HOLIDAY_API_BASE}/${year}`, {
      method: "GET",
      headers: { accept: "application/json" },
    });

    if (!res.ok) {
      cache.loaded = true;
      return;
    }

    const data = (await res.json()) as HolidayApiItem[];
    for (const h of data) {
      cache.dates.add(h.date); // YYYY-MM-DD
    }
    cache.loaded = true;
  } catch {
    // Em caso de falha na API, apenas marcamos como loaded vazio.
    cache.loaded = true;
  }
}

export function isNationalHolidayCached(date: Date): boolean {
  const year = date.getUTCFullYear();
  const cache = nationalHolidaysCache.get(year);
  if (!cache || !cache.loaded) return false;
  const month = date.getUTCMonth() + 1;
  const day = date.getUTCDate();
  const key = `${year.toString().padStart(4, "0")}-${month.toString().padStart(2, "0")}-${day
    .toString()
    .padStart(2, "0")}`;
  return cache.dates.has(key);
}

