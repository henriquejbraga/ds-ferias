import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function normalizeParam(param: string | string[] | undefined, def = ""): string {
  if (typeof param === "string") return param;
  if (Array.isArray(param)) return param[0] ?? def;
  return def;
}
