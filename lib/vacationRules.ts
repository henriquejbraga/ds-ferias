// ============================================================
// REGRAS DE NEGÓCIO — SISTEMA DE FÉRIAS
// Hierarquia: FUNCIONARIO → COORDENADOR → GERENTE → RH
// ============================================================

import type { VacationStatus } from "@/generated/prisma/enums";

export const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function toUtcMidnight(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function daysBetweenInclusive(start: Date, end: Date): number {
  const s = toUtcMidnight(start);
  const e = toUtcMidnight(end);
  return Math.round((e.getTime() - s.getTime()) / ONE_DAY_MS) + 1;
}

function getUtcWeekDay(date: Date): number {
  const d = toUtcMidnight(date);
  return d.getUTCDay(); // 0..6
}

export type VacationPeriod = {
  start: Date;
  end: Date;
};

// ============================================================
// HIERARQUIA DE ROLES
// ============================================================

export const ROLE_LEVEL: Record<string, number> = {
  COLABORADOR: 1,  // legado
  FUNCIONARIO: 1,
  GESTOR: 2,       // legado
  COORDENADOR: 2,
  GERENTE: 3,
  DIRETOR: 4,
  RH: 5,
};

export const ROLE_LABEL: Record<string, string> = {
  COLABORADOR: "Funcionário(a)",
  FUNCIONARIO: "Funcionário(a)",
  GESTOR: "Coordenador(a)",
  COORDENADOR: "Coordenador(a)",
  GERENTE: "Gerente",
  DIRETOR: "Diretor(a)",
  RH: "RH / Admin",
};

export const ROLE_COLOR: Record<string, string> = {
  COLABORADOR: "blue",
  FUNCIONARIO: "blue",
  GESTOR: "indigo",
  COORDENADOR: "indigo",
  GERENTE: "purple",
  DIRETOR: "violet",
  RH: "emerald",
};

/** Retorna o nível numérico do papel (1=Funcionário, 4=RH) */
export function getRoleLevel(role: string): number {
  return ROLE_LEVEL[role] ?? 1;
}

/** Retorna o rótulo amigável do papel */
export function getRoleLabel(role: string): string {
  return ROLE_LABEL[role] ?? role;
}

/** Estados em que a solicitação está aprovada (gozo / consome período aquisitivo). */
const APPROVED_VACATION_LIST = [
  "APROVADO_COORDENADOR",
  "APROVADO_GESTOR",
  "APROVADO_GERENTE",
  "APROVADO_DIRETOR",
] as const satisfies readonly VacationStatus[];

export const APPROVED_VACATION_STATUSES = APPROVED_VACATION_LIST;

/** PENDENTE ou aprovado — sobreposição de períodos / limites por ciclo (tipado para Prisma). */
export const PENDING_OR_APPROVED_VACATION_STATUSES: VacationStatus[] = ["PENDENTE", ...APPROVED_VACATION_LIST];

const APPROVED_VACATION_STATUS_SET = new Set<string>(APPROVED_VACATION_LIST);

export function isVacationApprovedStatus(status: string): boolean {
  // Legado: se por algum motivo existir histórico com APROVADO_RH (antes da remoção do enum),
  // tratamos como aprovado para exibição/UX, mas NÃO incluímos esse valor nas listas usadas
  // por queries Prisma (evita erro quando o enum já não contém APROVADO_RH).
  if (status === "APROVADO_RH") return true;
  return APPROVED_VACATION_STATUS_SET.has(status);
}

/** Rótulo curto para telas e relatórios (enum → texto). */
export function getVacationStatusDisplayLabel(status: string): string {
  const map: Record<string, string> = {
    PENDENTE: "Pendente aprovação",
    APROVADO_COORDENADOR: "Aprovado (coordenador)",
    APROVADO_GESTOR: "Aprovado (coordenador)",
    APROVADO_GERENTE: "Aprovado (gerente)",
    APROVADO_DIRETOR: "Aprovado (diretoria)",
    // RH deixou de aprovar novas solicitações.
    // Para manter histórico legível sem “voltar” RH para o fluxo, tratamos como diretoria na UI.
    APROVADO_RH: "Aprovado (diretoria)",
    REPROVADO: "Reprovado",
    CANCELADO: "Cancelado",
  };
  return map[status] ?? status.replace(/_/g, " ");
}

// ============================================================
// LÓGICA DE APROVAÇÃO MULTI-NÍVEL
// ============================================================

/**
 * Dado o papel do aprovador, retorna o status gravado ao aprovar (única etapa).
 */
export function getNextApprovalStatus(approverRole: string): string {
  const level = ROLE_LEVEL[approverRole] ?? 1;
  if (level === 2) return "APROVADO_COORDENADOR";
  if (level === 3) return "APROVADO_GERENTE";
  if (level === 4) return "APROVADO_DIRETOR";
  // RH não aprova mais solicitações. Mantemos um fallback para evitar usos acidentais.
  if (level >= 5) return "APROVADO_DIRETOR";
  return "PENDENTE";
}

/**
 * Verifica se um aprovador pode agir sobre uma solicitação com base em:
 * 1. Seu nível de cargo vs o nível do solicitante
 * 2. O status atual da solicitação (sequência de aprovação)
 * 3. Não pode aprovar a própria solicitação
 */
export function canApproveRequest(
  approverRole: string,
  approverUserId: string,
  request: {
    userId: string;
    status: string;
    user: { role: string };
  },
): boolean {
  // RH não aprova mais solicitações (apenas consulta/backoffice).
  if (approverRole === "RH") return false;

  // Não pode aprovar a própria solicitação
  if (request.userId === approverUserId) return false;

  const approverLevel = ROLE_LEVEL[approverRole] ?? 1;
  const requesterLevel = ROLE_LEVEL[request.user.role] ?? 1;

  // Aprovador deve ser de nível superior ao solicitante
  if (approverLevel <= requesterLevel) return false;

  // Mapeamento de status → nível mínimo necessário para aprovar
  const requiredLevel = getRequiredApproverLevel(request.status, requesterLevel);
  if (requiredLevel === null) return false; // já está em estado terminal

  return approverLevel >= requiredLevel;
}

/**
 * Retorna o nível mínimo necessário para aprovar uma solicitação
 * dado o status atual e o nível do solicitante.
 */
function getRequiredApproverLevel(status: string, _requesterLevel: number): number | null {
  switch (status) {
    case "PENDENTE":
      return 2;
    case "APROVADO_COORDENADOR":
    case "APROVADO_GESTOR":
    case "APROVADO_GERENTE":
    case "APROVADO_DIRETOR":
    case "APROVADO_RH":
      return null;
    default:
      return null;
  }
}

/**
 * Retorna quem precisa aprovar em seguida, para exibição na UI.
 */
export function getNextApprover(status: string, requesterRole: string): string | null {
  const requesterLevel = ROLE_LEVEL[requesterRole] ?? 1;
  const requiredLevel = getRequiredApproverLevel(status, requesterLevel);

  if (requiredLevel === null) return null;

  const levelToLabel: Record<number, string> = {
    2: "Líder direto",
    3: "Gerente",
    4: "Diretor(a)",
  };

  return levelToLabel[requiredLevel] ?? null;
}

/**
 * Retorna as etapas do fluxo de aprovação para um solicitante.
 * Usado para renderizar o indicador de progresso.
 */
export function getApprovalSteps(requesterRole: string): string[] {
  const level = ROLE_LEVEL[requesterRole] ?? 1;

  if (level >= 2) return []; // Coordenador/Gestor/Gerente/Diretor/RH
  return ["Líder direto"];
}

/**
 * Retorna o progresso atual no fluxo de aprovação (etapa atual).
 */
export function getApprovalProgress(status: string): number {
  switch (status) {
    case "PENDENTE":
      return 0;
    case "APROVADO_GERENTE":
    case "APROVADO_COORDENADOR":
    case "APROVADO_GESTOR":
    case "APROVADO_DIRETOR":
    case "APROVADO_RH":
      return 1;
    default:
      return 0;
  }
}

/**
 * Rótulo da etapa no card de solicitação, na perspectiva de quem aprova.
 * Evita mostrar só "Líder direto" quando o aprovador é gerente/RH de reporte indireto.
 */
export function getApproverRelationshipStepLabel(
  approverId: string,
  approverRole: string,
  employee: {
    managerId?: string | null;
    manager?: { id?: string | null } | null;
  } | null | undefined,
): string | undefined {
  if (!employee) return undefined;
  const level = getRoleLevel(approverRole);
  const directLeaderId = employee.managerId ?? employee.manager?.id ?? null;

  if (level >= 5) return undefined;

  if (level === 4) {
    if (directLeaderId && directLeaderId === approverId) return "Você é o líder direto";
    return "Aprovação na diretoria";
  }

  if (level === 3) {
    if (directLeaderId && directLeaderId === approverId) return "Você é o líder direto";
    return "Você aprova como líder indireto";
  }

  if (level === 2) {
    if (directLeaderId && directLeaderId === approverId) return "Você é o líder direto";
    return undefined;
  }

  return undefined;
}

// ============================================================
// VISIBILIDADE POR EQUIPE
// ============================================================

/**
 * Verifica se um usuário (aprovador) tem visibilidade sobre uma solicitação.
 * Baseado na hierarquia de reportes.
 */
export function hasTeamVisibility(
  approverRole: string,
  approverUserId: string,
  request: {
    userId: string;
    user: {
      managerId: string | null;
      manager?: { managerId: string | null; manager?: { managerId: string | null } | null } | null;
    };
  },
): boolean {
  // RH vê tudo
  if (approverRole === "RH") return true;

  // Coordenador/Gestor: vê apenas reportes diretos + próprias solicitações
  if (ROLE_LEVEL[approverRole] === 2) {
    return (
      request.user.managerId === approverUserId ||
      request.userId === approverUserId
    );
  }

  // Gerente: vê reportes diretos (coordenadores) E seus subordinados (funcionários)
  if (ROLE_LEVEL[approverRole] === 3) {
    return (
      request.user.managerId === approverUserId ||           // coordenador direto
      request.user.manager?.managerId === approverUserId ||  // funcionário do coord
      request.userId === approverUserId                       // própria solicitação
    );
  }

  // Diretor: vê reportes diretos (gerentes), indiretos (coordenadores/funcionários) e próprias solicitações.
  if (ROLE_LEVEL[approverRole] === 4) {
    return (
      request.user.managerId === approverUserId || // gerente direto
      request.user.manager?.managerId === approverUserId || // coordenador indireto
      request.user.manager?.manager?.managerId === approverUserId || // funcionário indireto (via coordenador)
      request.userId === approverUserId
    );
  }

  return false;
}

// ============================================================
// CÁLCULO DE SALDO DE FÉRIAS
// ============================================================

export type VacationBalance = {
  entitledDays: number;   // dias a que tem direito no ciclo
  usedDays: number;       // dias já utilizados (aprovados)
  pendingDays: number;    // dias em solicitações pendentes
  availableDays: number;  // saldo disponível
  cycleYear: number;      // ano do ciclo atual
  hasEntitlement: boolean;// trabalha há pelo menos 12 meses?
  monthsWorked: number;   // meses de trabalho até hoje
};

function getChargeableDays(start: Date, end: Date, hasAbono?: boolean): number {
  const raw = calcDays(start, end);
  // O período salvo representa o total solicitado no ciclo.
  // O abono afeta o retorno (gozo), não o consumo de saldo total.
  void hasAbono;
  return raw;
}

/**
 * Calcula o saldo de férias de um colaborador.
 * CLT: a cada 12 meses trabalhados, o funcionário adquire 30 dias.
 * Implementação: considera até 2 períodos aquisitivos completos (60 dias).
 * Períodos mais antigos são tratados como prescritos para efeito de saldo.
 */
export function calculateVacationBalance(
  hireDate: Date | null | undefined,
  approvedRequests: { startDate: Date; endDate: Date; status: string; abono?: boolean }[],
  today = new Date(),
): VacationBalance {
  const currentYear = today.getFullYear();

  if (!hireDate) {
    const usedDays = approvedRequests
      .filter((r) => isVacationApprovedStatus(r.status) && new Date(r.startDate).getUTCFullYear() === currentYear)
      .reduce((sum, r) => sum + getChargeableDays(r.startDate, r.endDate, r.abono), 0);
    const normalizedUsed = Math.min(30, usedDays);
    const pendingDays = calcUsedDays(approvedRequests, "PENDENTE", currentYear);
    const normalizedPending = Math.min(Math.max(0, 30 - normalizedUsed), pendingDays);
    return {
      entitledDays: 30,
      usedDays: normalizedUsed,
      pendingDays: normalizedPending,
      availableDays: Math.max(0, 30 - normalizedUsed - normalizedPending),
      cycleYear: currentYear,
      hasEntitlement: true,
      monthsWorked: 999,
    };
  }

  const hire = toUtcMidnight(new Date(hireDate));
  // Meses corridos (calendário): 12 meses = 1 período, 24 meses = 2 períodos (60 dias)
  let monthsWorked =
    (today.getFullYear() - hire.getFullYear()) * 12 +
    (today.getMonth() - hire.getMonth());
  if (today.getDate() < hire.getDate()) monthsWorked -= 1;
  monthsWorked = Math.max(0, monthsWorked);

  if (monthsWorked < 12) {
    // Ainda não adquiriu férias
    return {
      entitledDays: 0,
      usedDays: 0,
      pendingDays: 0,
      availableDays: 0,
      cycleYear: currentYear,
      hasEntitlement: false,
      monthsWorked,
    };
  }

  // Calcula quantos ciclos completos de 12 meses foram adquiridos
  const yearsWorked = Math.floor(monthsWorked / 12);
  const MAX_CYCLES = 2; // até 2 períodos aquisitivos (60 dias)
  const cyclesCovered = Math.min(yearsWorked, MAX_CYCLES);
  const totalEntitled = cyclesCovered * 30;

  // Janela: últimos N*12 meses a partir de hoje (cobre todos os ciclos adquiridos)
  const cutoff = new Date(today);
  cutoff.setMonth(cutoff.getMonth() - cyclesCovered * 12);

  const totalUsed = approvedRequests
    .filter((r) => isVacationApprovedStatus(r.status) && new Date(r.endDate) >= cutoff)
    .reduce((sum, r) => sum + getChargeableDays(r.startDate, r.endDate, r.abono), 0);

  const totalPending = approvedRequests
    .filter((r) => r.status === "PENDENTE" && new Date(r.endDate) >= cutoff)
    .reduce((sum, r) => sum + getChargeableDays(r.startDate, r.endDate, r.abono), 0);

  const normalizedUsed = Math.min(totalEntitled, totalUsed);
  const normalizedPending = Math.min(Math.max(0, totalEntitled - normalizedUsed), totalPending);
  const available = Math.max(0, totalEntitled - normalizedUsed - normalizedPending);

  return {
    entitledDays: totalEntitled,
    usedDays: normalizedUsed,
    pendingDays: normalizedPending,
    availableDays: available,
    cycleYear: currentYear,
    hasEntitlement: true,
    monthsWorked,
  };
}

function calcDays(start: Date, end: Date): number {
  const raw = daysBetweenInclusive(start, end);
  // CLT: um período de férias não pode exceder 30 dias; evita 31 por arredondamento/fuso
  return Math.min(Math.max(1, raw), 30);
}

function calcUsedDays(
  requests: { startDate: Date; endDate: Date; status: string; abono?: boolean }[],
  status: string,
  year: number,
): number {
  return requests
    .filter((r) => r.status === status && new Date(r.startDate).getUTCFullYear() === year)
    .reduce((sum, r) => sum + getChargeableDays(r.startDate, r.endDate, r.abono), 0);
}

// ============================================================
// FERIADOS – SÃO PAULO (NACIONAL + ESTADUAL/MUNICIPAL)
// ============================================================

export function isSaoPauloHoliday(date: Date): boolean {
  const d = toUtcMidnight(date);
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1; // 1-12
  const day = d.getUTCDate();

  // Fixos nacionais
  const fixed = [
    [1, 1],   // 01/01 – Confraternização Universal
    [4, 21],  // 21/04 – Tiradentes
    [5, 1],   // 01/05 – Dia do Trabalho
    [9, 7],   // 07/09 – Independência
    [10, 12], // 12/10 – N. Sra Aparecida
    [11, 2],  // 02/11 – Finados
    [11, 15], // 15/11 – Proclamação da República
    [12, 25], // 25/12 – Natal
  ];

  // Fixos estado/município SP
  const fixedSp = [
    [1, 25],  // 25/01 – Aniversário da cidade de SP
    [7, 9],   // 09/07 – Revolução Constitucionalista (feriado estadual)
    [11, 20], // 20/11 – Consciência Negra (feriado municipal SP)
  ];

  if (fixed.concat(fixedSp).some(([m, d0]) => m === month && d0 === day)) return true;

  // Móveis baseados na Páscoa: Carnaval (3ª feira), Sexta-Feira Santa, Corpus Christi
  const easter = getEasterSunday(year); // domingo
  const carnival = addDays(easter, -47);      // terça de carnaval
  const goodFriday = addDays(easter, -2);     // sexta-feira santa
  const corpusChristi = addDays(easter, 60);  // corpus christi

  const movables = [carnival, goodFriday, corpusChristi];
  return movables.some((h) => {
    // h já é toUtcMidnight ou Date.UTC
    return h.getTime() === d.getTime();
  });
}

function addDays(base: Date, days: number): Date {
  const d = toUtcMidnight(base);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

// Algoritmo de Gauss para Páscoa (calendário gregoriano)
function getEasterSunday(year: number): Date {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31); // 3=mar, 4=abr
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
}

// ============================================================
// DETECÇÃO DE CONFLITOS DE EQUIPE
// ============================================================

export type TeamConflict = {
  conflictingCount: number;
  teamSize: number;
  conflictPercent: number;
  isBlocked: boolean; // > 50% da equipe
  isWarning: boolean; // > 30% da equipe
  names: string[];
};

/**
 * Detecta se a solicitação conflita com outras da mesma equipe.
 * Aviso se > 30%, bloqueio se > 50%.
 */
export function detectTeamConflicts(
  start: Date,
  end: Date,
  teamMembers: { name: string; requests: { startDate: Date; endDate: Date; status: string }[] }[],
): TeamConflict {
  const teamSize = teamMembers.length;
  if (teamSize === 0) {
    return { conflictingCount: 0, teamSize: 0, conflictPercent: 0, isBlocked: false, isWarning: false, names: [] };
  }

  const conflicting = teamMembers.filter((member) =>
    member.requests.some((r) => {
      const isActive = r.status === "PENDENTE" || isVacationApprovedStatus(r.status);
      if (!isActive) return false;
      // Overlap check: períodos se sobrepõem se start < r.end && end > r.start
      return new Date(start) < new Date(r.endDate) && new Date(end) > new Date(r.startDate);
    }),
  );

  const conflictingCount = conflicting.length;
  const conflictPercent = Math.round((conflictingCount / teamSize) * 100);

  return {
    conflictingCount,
    teamSize,
    conflictPercent,
    /** > 50% do time com férias sobrepostas — mensagem mais grave na aprovação */
    isBlocked: conflictPercent > 50,
    /** Qualquer outro membro do time com período sobreposto (2+ pessoas no mesmo intervalo) */
    isWarning: conflictingCount >= 1,
    names: conflicting.map((m) => m.name),
  };
}

// ============================================================
// VALIDAÇÕES CLT (mantidas + aprimoradas)
// ============================================================

/**
 * Validação CLT para UM bloco de férias.
 */
export function validateCltPeriod(startDate: Date, endDate: Date): string | null {
  const days = daysBetweenInclusive(startDate, endDate);

  if (days < 5) return "Período mínimo de férias é de 5 dias corridos (CLT).";
  if (days > 30) return "Período máximo em um único bloco é de 30 dias.";

  const startWeekDay = getUtcWeekDay(startDate);
  if (startWeekDay === 5 || startWeekDay === 6) {
    return "O início das férias não pode ocorrer na sexta ou no sábado (art. 134, §3º, CLT).";
  }
  const endWeekDay = getUtcWeekDay(endDate);
  if (endWeekDay === 0 || endWeekDay === 6) {
    return "O término das férias não pode ocorrer no sábado ou no domingo (repouso semanal remunerado).";
  }

  const today = toUtcMidnight(new Date());
  const diffDays = Math.floor(
    (toUtcMidnight(startDate).getTime() - today.getTime()) / ONE_DAY_MS,
  );

  if (diffDays < 30) return "Aviso prévio mínimo de 30 dias não respeitado.";

  return null;
}

/**
 * Validação CLT para férias fracionadas em até 3 períodos.
 * Se existingDaysInCycle for informado (dias já pendentes/aprovados no ciclo), a soma desta
 * solicitação com os existentes não pode ultrapassar 30 dias, e a regra dos 14 dias pode
 * já estar atendida por outra solicitação do ciclo.
 */
export function validateCltPeriods(
  periods: VacationPeriod[],
  options: {
    checkAdvanceNotice?: boolean;
    /** Dias já solicitados no ciclo (pendentes + aprovados), para permitir fracionar em mais de uma solicitação */
    existingDaysInCycle?: number;
    /** Direito total no ciclo (ex.: 30 ou 60 dias); usado para não ultrapassar o teto */
    entitledDays?: number;
  } = { checkAdvanceNotice: true },
): string | null {
  if (!periods.length) return "É necessário informar ao menos um período de férias.";
  if (periods.length > 3) return "As férias podem ser fracionadas em no máximo 3 períodos.";

  const sorted = [...periods].sort((a, b) => a.start.getTime() - b.start.getTime());
  const existingDays = options.existingDaysInCycle ?? 0;

  let hasPeriodWith14OrMore = false;

  for (let i = 0; i < sorted.length; i++) {
    const { start, end } = sorted[i];
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
      return "Período de férias inválido.";
    }

    const days = daysBetweenInclusive(start, end);
    if (days < 5) return "Cada período deve ter no mínimo 5 dias corridos.";
    if (days >= 14) hasPeriodWith14OrMore = true;

    // CLT (art. 134, §3º e interpretação): término não pode ser no sábado ou domingo (DSR)
    const endWeekDay = getUtcWeekDay(end); // 0 = domingo, 6 = sábado
    if (endWeekDay === 0 || endWeekDay === 6) {
      return "O término das férias não pode ocorrer no sábado ou no domingo (repouso semanal remunerado).";
    }

    if (i > 0 && start <= sorted[i - 1].end) {
      return "Os períodos não podem se sobrepor.";
    }
  }

  // CLT: pelo menos um período de 14 dias no ciclo; se já há 14+ dias em outra solicitação, não exige nesta
  if (existingDays < 14 && !hasPeriodWith14OrMore) {
    return "Pelo menos um período deve ter 14 dias ou mais (CLT).";
  }

  const totalDays = sorted.reduce((acc, p) => acc + daysBetweenInclusive(p.start, p.end), 0);

  const entitled = options.entitledDays ?? 30;
  const totalInCycle = existingDays + totalDays;
  if (totalInCycle > entitled) {
    return `Total do ciclo não pode ultrapassar ${entitled} dias (seu direito). Você já tem ${existingDays} dias no ciclo e está solicitando ${totalDays} (total: ${totalInCycle}).`;
  }
  // CLT art. 134, §1º: fracionamento permitido em até 3 períodos; não exige os 30 dias numa só solicitação.
  // Pode solicitar 14 agora e o restante depois, desde que um período tenha ≥14 dias e total no ciclo ≤ entitled.

  if (options.checkAdvanceNotice) {
    const firstStart = sorted[0].start;
    const today = toUtcMidnight(new Date());
    const diffDays = Math.floor(
      (toUtcMidnight(firstStart).getTime() - today.getTime()) / ONE_DAY_MS,
    );
    if (diffDays < 30) return "O primeiro período deve respeitar aviso prévio mínimo de 30 dias.";

    // Lei 13.467/2017, art. 134, §3º: é vedado o início das férias
    // no período de 2 dias que antecede feriado ou repouso semanal remunerado.
    // DSR: assumimos domingo → não permitir início na sexta (5) ou sábado (6).
    const weekDay = getUtcWeekDay(firstStart); // 0 = domingo, 6 = sábado
    if (weekDay === 5 || weekDay === 6) {
      return "O início das férias não pode ocorrer na sexta ou no sábado, conforme art. 134, §3º, da CLT.";
    }

    // Feriados (São Paulo capital + nacionais): não pode iniciar nos 2 dias que antecedem
    for (let offset = 1; offset <= 2; offset++) {
      const check = new Date(firstStart);
      check.setUTCDate(check.getUTCDate() + offset);
      if (isSaoPauloHoliday(check)) {
        return "O início das férias não pode ocorrer nos 2 dias que antecedem feriado, conforme art. 134, §3º, da CLT.";
      }
    }
  }

  return null;
}

/**
 * Verifica se uma solicitação cai em período de bloqueio da empresa.
 */
export function checkBlackoutPeriods(
  start: Date,
  end: Date,
  blackouts: { startDate: Date; endDate: Date; reason: string; department?: string | null }[],
  userDepartment?: string | null,
): string | null {
  for (const blackout of blackouts) {
    // Aplica se for geral (sem departamento) ou do mesmo departamento
    const applies =
      !blackout.department ||
      !userDepartment ||
      blackout.department === userDepartment;

    if (!applies) continue;

    // Verifica sobreposição
    if (new Date(start) <= new Date(blackout.endDate) && new Date(end) >= new Date(blackout.startDate)) {
      const startFmt = new Date(blackout.startDate).toLocaleDateString("pt-BR");
      const endFmt = new Date(blackout.endDate).toLocaleDateString("pt-BR");
      return `Período bloqueado pela empresa: "${blackout.reason}" (${startFmt} – ${endFmt}).`;
    }
  }
  return null;
}
