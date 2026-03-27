import { createPrivateKey, createPublicKey, privateDecrypt, constants } from "node:crypto";

/**
 * PEM PKCS#8 da chave privada RSA (2048+ bits). Gere com:
 * openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out login_rsa_private.pem
 * Coloque o conteúdo em LOGIN_RSA_PRIVATE_KEY (quebras de linha como \n numa string .env).
 */
function getLoginPrivateKeyPem(): string | null {
  const raw = process.env.LOGIN_RSA_PRIVATE_KEY;
  if (!raw || raw.trim().length < 80) return null;
  return raw.includes("\\n") ? raw.replace(/\\n/g, "\n") : raw;
}

export function isLoginPasswordEncryptionConfigured(): boolean {
  try {
    return getPrivateKeyObject() !== null;
  } catch {
    return false;
  }
}

function getPrivateKeyObject() {
  const pem = getLoginPrivateKeyPem();
  if (!pem) return null;
  return createPrivateKey(pem);
}

/** DER SPKI em base64url, para o browser importar com Web Crypto. */
export function getPublicKeySpkiDerBase64Url(): string | null {
  const priv = getPrivateKeyObject();
  if (!priv) return null;
  const pub = createPublicKey(priv);
  const der = pub.export({ type: "spki", format: "der" }) as Buffer;
  return der.toString("base64url");
}

/** Descriptografa o payload enviado pelo cliente (RSA-OAEP SHA-256). */
export function decryptLoginPassword(encryptedBase64Url: string): string {
  const key = getPrivateKeyObject();
  if (!key) {
    throw new Error("LOGIN_RSA_PRIVATE_KEY não configurada");
  }
  const buf = Buffer.from(encryptedBase64Url, "base64url");
  const decrypted = privateDecrypt(
    {
      key,
      padding: constants.RSA_PKCS1_OAEP_PADDING,
      oaepHash: "sha256",
    },
    buf,
  );
  return decrypted.toString("utf8");
}
