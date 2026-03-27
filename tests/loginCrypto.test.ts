import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { constants, generateKeyPairSync, publicEncrypt } from "node:crypto";
import {
  decryptLoginPassword,
  getPublicKeySpkiDerBase64Url,
  isLoginPasswordEncryptionConfigured,
} from "@/lib/loginCrypto";

describe("loginCrypto", () => {
  let privatePem: string;
  let publicPem: string;

  beforeAll(() => {
    const pair = generateKeyPairSync("rsa", {
      modulusLength: 2048,
      publicKeyEncoding: { type: "spki", format: "pem" },
      privateKeyEncoding: { type: "pkcs8", format: "pem" },
    });
    publicPem = pair.publicKey;
    privatePem = pair.privateKey;
    process.env.LOGIN_RSA_PRIVATE_KEY = privatePem;
  });

  afterAll(() => {
    delete process.env.LOGIN_RSA_PRIVATE_KEY;
  });

  it("isLoginPasswordEncryptionConfigured quando PEM válido", () => {
    expect(isLoginPasswordEncryptionConfigured()).toBe(true);
  });

  it("getPublicKeySpkiDerBase64Url retorna base64url não vazio", () => {
    const spki = getPublicKeySpkiDerBase64Url();
    expect(spki).toBeTruthy();
    expect(spki!.length).toBeGreaterThan(32);
  });

  it("decryptLoginPassword reverte RSA-OAEP SHA-256 (como no browser)", () => {
    const secret = "senha123";
    const encrypted = publicEncrypt(
      {
        key: publicPem,
        padding: constants.RSA_PKCS1_OAEP_PADDING,
        oaepHash: "sha256",
      },
      Buffer.from(secret, "utf8"),
    );
    const b64url = encrypted.toString("base64url");
    expect(decryptLoginPassword(b64url)).toBe(secret);
  });
});
