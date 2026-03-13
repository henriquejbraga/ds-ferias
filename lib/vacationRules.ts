// ============================================================
// REGRAS DE NEGÓCIO — SISTEMA DE FÉRIAS
// Hierarquia: FUNCIONARIO → COORDENADOR → GERENTE → RH
// ============================================================

export const ONE_DAY_MS = 24 * 60 * 60 * 1000;

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
  RH: 4,
};

export const ROLE_LABEL: Record<string, string> = {
  COLABORADOR: "Funcionário(a)",
  FUNCIONARIO: "Funcionário(a)",
  GESTOR: "Coordenador(a)",
  COORDENADOR: "Coordenador(a)",
  GERENTE: "Gerente",
  RH: "RH / Admin",
};

export const ROLE_COLOR: Record<string, string> = {
  COLABORADOR: "blue",
  FUNCIONARIO: "blue",
  GESTOR: "indigo",
  COORDENADOR: "indigo",
  GERENTE: "purple",
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

// ============================================================
// LÓGICA DE APROVAÇÃO MULTI-NÍVEL
// ============================================================

/**
 * Dado o papel do aprovador, retorna o próximo status da solicitação.
 * A progressão segue a hierarquia de cargos.
 */
export function getNextApprovalStatus(approverRole: string): string {
  const level = ROLE_LEVEL[approverRole] ?? 1;
  if (level >= 4) return "APROVADO_RH";
  if (level === 3) return "APROVADO_GERENTE";
  return "APROVADO_COORDENADOR";
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
function getRequiredApproverLevel(status: string, requesterLevel: number): number | null {
  switch (status) {
    case "PENDENTE":
      // Precisa do próximo nível acima do solicitante
      return requesterLevel + 1;
    case "APROVADO_COORDENADOR":
    case "APROVADO_GESTOR": // legado
      // Precisa de Gerente (nível 3) ou superior
      return 3;
    case "APROVADO_GERENTE":
      // Precisa de RH (nível 4)
      return 4;
    default:
      // Status terminal: APROVADO_RH, REPROVADO, CANCELADO
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
    2: "Coordenador(a)",
    3: "Gerente",
    4: "RH",
  };

  return levelToLabel[requiredLevel] ?? null;
}

/**
 * Retorna as etapas do fluxo de aprovação para um solicitante.
 * Usado para renderizar o indicador de progresso.
 */
export function getApprovalSteps(requesterRole: string): string[] {
  const level = ROLE_LEVEL[requesterRole] ?? 1;

  if (level >= 4) return []; // RH não precisa de aprovação de outros (ou precisa de GERENTE)
  if (level === 3) return ["RH"]; // Gerente só precisa do RH
  if (level === 2) return ["Gerente", "RH"]; // Coordenador: Gerente → RH
  return ["Coordenador(a)", "Gerente", "RH"]; // Funcionário: todos os níveis
}

/**
 * Retorna o progresso atual no fluxo de aprovação (etapa atual).
 */
export function getApprovalProgress(status: string): number {
  switch (status) {
    case "PENDENTE": return 0;
    case "APROVADO_COORDENADOR":
    case "APROVADO_GESTOR": return 1;
    case "APROVADO_GERENTE": return 2;
    case "APROVADO_RH": return 3;
    default: return 0;
  }
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
      manager?: { managerId: string | null } | null;
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

/**
 * Calcula o saldo de férias de um colaborador.
 * CLT: a cada 12 meses trabalhados, o funcionário adquire 30 dias.
 */
export function calculateVacationBalance(
  hireDate: Date | null | undefined,
  approvedRequests: { startDate: Date; endDate: Date; status: string }[],
  today = new Date(),
): VacationBalance {
  const currentYear = today.getFullYear();

  if (!hireDate) {
    // Sem data de admissão: assume entitlement completo
    const usedDays = calcUsedDays(approvedRequests, "APROVADO_RH", currentYear);
    const pendingDays = calcUsedDays(approvedRequests, "PENDENTE", currentYear) +
      calcUsedDays(approvedRequests, "APROVADO_COORDENADOR", currentYear) +
      calcUsedDays(approvedRequests, "APROVADO_GESTOR", currentYear) +
      calcUsedDays(approvedRequests, "APROVADO_GERENTE", currentYear);
    return {
      entitledDays: 30,
      usedDays,
      pendingDays,
      availableDays: Math.max(0, 30 - usedDays - pendingDays),
      cycleYear: currentYear,
      hasEntitlement: true,
      monthsWorked: 999,
    };
  }

  const hire = new Date(hireDate);
  const diffMs = today.getTime() - hire.getTime();
  const monthsWorked = Math.floor(diffMs / (ONE_DAY_MS * 30.44));

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

  // Calcula quantos ciclos completos de 12 meses
  const yearsWorked = Math.floor(monthsWorked / 12);
  const totalEntitled = yearsWorked * 30;

  // Dias já aprovados (histórico completo)
  const totalUsed = approvedRequests
    .filter((r) => r.status === "APROVADO_RH")
    .reduce((sum, r) => sum + calcDays(r.startDate, r.endDate), 0);

  // Dias em aprovação (pendentes)
  const totalPending = approvedRequests
    .filter((r) =>
      ["PENDENTE", "APROVADO_COORDENADOR", "APROVADO_GESTOR", "APROVADO_GERENTE"].includes(r.status),
    )
    .reduce((sum, r) => sum + calcDays(r.startDate, r.endDate), 0);

  const available = Math.max(0, totalEntitled - totalUsed - totalPending);

  return {
    entitledDays: totalEntitled,
    usedDays: totalUsed,
    pendingDays: totalPending,
    availableDays: available,
    cycleYear: currentYear,
    hasEntitlement: true,
    monthsWorked,
  };
}

function calcDays(start: Date, end: Date): number {
  return Math.round((new Date(end).getTime() - new Date(start).getTime()) / ONE_DAY_MS) + 1;
}

function calcUsedDays(
  requests: { startDate: Date; endDate: Date; status: string }[],
  status: string,
  year: number,
): number {
  return requests
    .filter((r) => r.status === status && new Date(r.startDate).getFullYear() === year)
    .reduce((sum, r) => sum + calcDays(r.startDate, r.endDate), 0);
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
      const isActive = ["PENDENTE", "APROVADO_COORDENADOR", "APROVADO_GESTOR", "APROVADO_GERENTE", "APROVADO_RH"].includes(r.status);
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
    isBlocked: conflictPercent > 50,
    isWarning: conflictPercent > 30,
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
  const days = Math.round((endDate.getTime() - startDate.getTime()) / ONE_DAY_MS) + 1;

  if (days < 5) return "Período mínimo de férias é de 5 dias corridos (CLT).";
  if (days > 30) return "Período máximo em um único bloco é de 30 dias.";

  const today = new Date();
  const diffDays = Math.floor(
    (new Date(startDate).setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0)) / ONE_DAY_MS,
  );

  if (diffDays < 30) return "Aviso prévio mínimo de 30 dias não respeitado.";

  return null;
}

/**
 * Validação CLT para férias fracionadas em até 3 períodos.
 */
export function validateCltPeriods(
  periods: VacationPeriod[],
  options: { checkAdvanceNotice?: boolean } = { checkAdvanceNotice: true },
): string | null {
  if (!periods.length) return "É necessário informar ao menos um período de férias.";
  if (periods.length > 3) return "As férias podem ser fracionadas em no máximo 3 períodos.";

  const sorted = [...periods].sort((a, b) => a.start.getTime() - b.start.getTime());

  let hasPeriodWith14OrMore = false;

  for (let i = 0; i < sorted.length; i++) {
    const { start, end } = sorted[i];
    if (isNaN(start.getTime()) || isNaN(end.getTime()) || end < start) {
      return "Período de férias inválido.";
    }

    const days = Math.round((end.getTime() - start.getTime()) / ONE_DAY_MS) + 1;
    if (days < 5) return "Cada período deve ter no mínimo 5 dias corridos.";
    if (days >= 14) hasPeriodWith14OrMore = true;

    if (i > 0 && start <= sorted[i - 1].end) {
      return "Os períodos não podem se sobrepor.";
    }
  }

  if (!hasPeriodWith14OrMore) {
    return "Pelo menos um período deve ter 14 dias ou mais (CLT).";
  }

  const totalDays = sorted.reduce((acc, p) => {
    return acc + Math.round((p.end.getTime() - p.start.getTime()) / ONE_DAY_MS) + 1;
  }, 0);

  if (totalDays !== 30) {
    return "A soma dos períodos deve totalizar exatamente 30 dias corridos.";
  }

  if (options.checkAdvanceNotice) {
    const firstStart = sorted[0].start;
    const today = new Date();
    const diffDays = Math.floor(
      (firstStart.setHours(0, 0, 0, 0) - today.setHours(0, 0, 0, 0)) / ONE_DAY_MS,
    );
    if (diffDays < 30) return "O primeiro período deve respeitar aviso prévio mínimo de 30 dias.";
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
