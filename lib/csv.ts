// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function escapeCsvFormulas(value: any): string {
  if (value === null || value === undefined) return "";
  const str = String(value);

  // Sanitiza ponto-e-vírgula pois é o delimitador usado nos relatórios
  const sanitized = str.replace(/;/g, ",");

  // Previne CSV Injection adicionando um aspa simples antes de caracteres perigosos
  if (
    sanitized.startsWith("=") ||
    sanitized.startsWith("+") ||
    sanitized.startsWith("-") ||
    sanitized.startsWith("@") ||
    sanitized.startsWith("\t") ||
    sanitized.startsWith("\r")
  ) {
    return "'" + sanitized;
  }
  return sanitized;
}
