import type { VacationBalance } from "@/lib/vacationRules";

/**
 * Filtros da view Gestão (inbox/histórico) e export.
 */
export type DashboardFilters = {
  query: string;
  status: string;
  view: string;
  managerId: string;
  from: string;
  to: string;
  department: string;
};

/**
 * Membro do time com saldo e status para a aba Times.
 */
export type TeamMemberInfo = {
  user: {
    id: string;
    name: string;
    department?: string | null;
    hireDate?: Date | null;
    role: string;
  };
  balance: VacationBalance;
  isOnVacationNow: boolean;
  requests: Array<{
    id?: string;
    startDate: Date;
    endDate: Date;
    status: string;
    abono?: boolean;
    thirteenth?: boolean;
    history?: unknown[];
  }>;
};

/**
 * Dados agregados por coordenador (Coordenador ou Gerente).
 */
export type TeamDataCoord = {
  kind: "coord";
  teams: Array<{
    coordinatorId: string;
    coordinatorName: string;
    members: TeamMemberInfo[];
  }>;
};

/**
 * Dados agregados por gerente e coordenador (RH).
 */
export type TeamDataRH = {
  kind: "rh";
  gerentes: Array<{
    gerenteId: string;
    gerenteName: string;
    teams: Array<{
      coordinatorId: string;
      coordinatorName: string;
      members: TeamMemberInfo[];
    }>;
  }>;
};

export type TeamDataForTimes = TeamDataCoord | TeamDataRH;
