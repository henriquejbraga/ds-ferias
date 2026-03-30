"use client";

import type { TeamMemberInfoSerialized } from "./types";

export function TeamMemberStatusBadge({ member }: { member: TeamMemberInfoSerialized }) {
  // Removido conforme solicitado: "em times, eu quero ver somente o calendario"
  // Informações de férias marcadas, pendentes ou saldos devem ser consultadas no histórico.
  return null;
}
