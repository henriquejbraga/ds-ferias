import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Normaliza parâmetros de busca vindos do `searchParams` do Next:
 * - `string | string[] | undefined` → `string` (ou default).
 * - Arrays retornam apenas o primeiro valor.
 */
export function normalizeParam(
  value: string | string[] | undefined,
  defaultValue = "",
): string {
  if (Array.isArray(value)) {
    return value[0] ?? defaultValue;
  }
  if (typeof value === "string") {
    return value;
  }
  return defaultValue;
}

