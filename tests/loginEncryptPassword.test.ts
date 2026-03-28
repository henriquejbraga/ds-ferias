import { describe, it, expect, vi } from "vitest";
import { encryptPasswordForLogin } from "@/lib/login-encrypt-password";

const mockCrypto = {
  subtle: {
    importKey: vi.fn().mockResolvedValue("mock-key"),
    encrypt: vi.fn().mockResolvedValue(new Uint8Array([1, 2, 3]).buffer),
  },
};

describe("login-encrypt-password", () => {
  it("should encrypt password using web crypto", async () => {
    vi.stubGlobal("crypto", mockCrypto);
    vi.stubGlobal("window", { crypto: mockCrypto });

    const validB64 = "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA";
    const result = await encryptPasswordForLogin("password123", validB64);

    expect(mockCrypto.subtle.importKey).toHaveBeenCalled();
    expect(mockCrypto.subtle.encrypt).toHaveBeenCalled();
    expect(result).toBe("AQID");

    vi.unstubAllGlobals();
  });

  it("should return null if crypto is not available", async () => {
    vi.stubGlobal("crypto", undefined);
    // Mesmo sem crypto, o atob vai rodar se o browser existir. 
    // Mas a função encryptPasswordForLogin checa if(!crypto) antes.
    const result = await encryptPasswordForLogin("p", "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA");
    expect(result).toBeNull();
    vi.unstubAllGlobals();
  });
});
