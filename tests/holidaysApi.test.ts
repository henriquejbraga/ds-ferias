import { describe, it, expect, beforeEach, afterAll, vi } from "vitest";
import { ensureNationalHolidaysLoaded, isNationalHolidayCached } from "@/lib/holidaysApi";

// isNationalHolidayCached é função internalizada via closure do módulo; testamos o comportamento
// observable através do efeito colateral de ensureNationalHolidaysLoaded no modo de teste.

describe("ensureNationalHolidaysLoaded (NODE_ENV=test)", () => {
  const ORIGINAL_NODE_ENV = process.env.NODE_ENV;

  beforeEach(() => {
    process.env.NODE_ENV = "test";
  });

  it("deve marcar o ano como carregado sem chamar a API externa em ambiente de teste", async () => {
    // Não há como observar diretamente o Map interno, mas pelo menos garantimos que
    // a função não lança e aceita chamadas repetidas para o mesmo ano.
    await expect(ensureNationalHolidaysLoaded(2026)).resolves.toBeUndefined();
    await expect(ensureNationalHolidaysLoaded(2026)).resolves.toBeUndefined();
  });

  afterAll(() => {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
  });
});

describe("ensureNationalHolidaysLoaded (ambiente real, com fetch mockado)", () => {
  const ORIGINAL_NODE_ENV = process.env.NODE_ENV;
  const originalFetch = global.fetch;

  beforeEach(() => {
    process.env.NODE_ENV = "production";
  });

  afterAll(() => {
    process.env.NODE_ENV = ORIGINAL_NODE_ENV;
    if (originalFetch) {
      global.fetch = originalFetch;
    }
  });

  it("carrega feriados nacionais quando a API responde com sucesso", async () => {
    const year = 2030;
    const holidayDate = `${year}-01-01`;

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => [
        { date: holidayDate, name: "Confraternização Universal" },
      ],
    } as any);

    await ensureNationalHolidaysLoaded(year);

    const date = new Date(`${holidayDate}T12:00:00Z`);
    expect(isNationalHolidayCached(date)).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("marca como carregado mesmo quando a API retorna erro (ok = false)", async () => {
    const year = 2031;

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      json: async () => [],
    } as any);

    await expect(ensureNationalHolidaysLoaded(year)).resolves.toBeUndefined();

    // Chamar novamente não deve disparar novo fetch, pois o ano já foi marcado como loaded
    await ensureNationalHolidaysLoaded(year);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("não lança erro quando o fetch dispara exceção", async () => {
    const year = 2032;

    global.fetch = vi.fn().mockRejectedValue(new Error("network error")) as any;

    await expect(ensureNationalHolidaysLoaded(year)).resolves.toBeUndefined();
    // Mesmo em caso de erro, a função deve ter tentado chamar a API uma vez
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});


