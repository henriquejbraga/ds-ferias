import { NextResponse } from "next/server";
import { getPublicKeySpkiDerBase64Url, isLoginPasswordEncryptionConfigured } from "@/lib/loginCrypto";

/**
 * Expõe a chave pública (SPKI) para o cliente cifrar a senha antes do POST /api/login.
 * Sem LOGIN_RSA_PRIVATE_KEY no servidor, responde 404 (login usa senha em texto no dev).
 */
export async function GET() {
  if (!isLoginPasswordEncryptionConfigured()) {
    return NextResponse.json({ error: "Criptografia de login não configurada" }, { status: 404 });
  }
  const spkiBase64Url = getPublicKeySpkiDerBase64Url();
  if (!spkiBase64Url) {
    return NextResponse.json({ error: "Chave inválida" }, { status: 500 });
  }
  return NextResponse.json({ spkiBase64Url }, { headers: { "Cache-Control": "public, max-age=3600" } });
}
