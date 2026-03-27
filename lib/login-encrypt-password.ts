"use client";

function base64UrlToUint8Array(base64url: string): Uint8Array {
  const pad = "=".repeat((4 - (base64url.length % 4)) % 4);
  const base64 = base64url.replace(/-/g, "+").replace(/_/g, "/") + pad;
  const bin = atob(base64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) {
    out[i] = bin.charCodeAt(i);
  }
  return out;
}

function uint8ArrayToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 1) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

/**
 * Cifra a senha com RSA-OAEP SHA-256 (mesmo algoritmo que `decryptLoginPassword` no servidor).
 */
export async function encryptPasswordForLogin(spkiDerBase64Url: string, password: string): Promise<string> {
  const spki = base64UrlToUint8Array(spkiDerBase64Url);
  const key = await crypto.subtle.importKey(
    "spki",
    spki.buffer.slice(spki.byteOffset, spki.byteOffset + spki.byteLength),
    { name: "RSA-OAEP", hash: "SHA-256" },
    false,
    ["encrypt"],
  );
  const ciphertext = await crypto.subtle.encrypt({ name: "RSA-OAEP" }, key, new TextEncoder().encode(password));
  return uint8ArrayToBase64Url(new Uint8Array(ciphertext));
}
