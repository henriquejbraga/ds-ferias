import { describe, it, expect, beforeEach, afterAll } from "vitest";
import { ensureNationalHolidaysLoaded } from "@/lib/holidaysApi";

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

