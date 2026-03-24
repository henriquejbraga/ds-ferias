export type VacationRequestSummary = {
  id?: string;
  status: string;
  startDate: Date | string;
  endDate: Date | string;
  abono?: boolean;
};

export type TeamMemberInfoSerialized = {
  user: {
    id: string;
    name: string;
    department?: string | null;
    hireDate?: string | null;
    role: string;
  };
  balance: { availableDays: number; pendingDays: number; isOnVacationNow?: boolean };
  isOnVacationNow: boolean;
  requests: VacationRequestSummary[];
  /** Visão gerente: capacidade (vermelho) só entre quem compartilha a mesma chave (ex.: mesmo time). */
  calendarCapacityGroupKey?: string;
  /** Ordenação: 0 = liderança direta, 1 = colaboradores por time */
  calendarSectionOrder?: number;
  /** Linha de seção antes desta linha (calendário consolidado) */
  calendarSectionTitle?: string;
  /** Subtítulo (ex.: coordenador + nome do squad) */
  calendarSubsectionTitle?: string;
  /** Texto na coluna nome (padrão: user.name) */
  calendarDisplayName?: string;
};

export type TeamDataCoord = {
  kind: "coord";
  teams: {
    coordinatorId: string;
    coordinatorName: string;
    teamKey: string; // chave única (coordenador + time)
    teamName: string;
    members: TeamMemberInfoSerialized[];
  }[];
};

export type TeamDataRH = {
  kind: "rh";
  gerentes: {
    gerenteId: string;
    gerenteName: string;
    coordinatorMembers?: TeamMemberInfoSerialized[];
    teams: {
      coordinatorId: string;
      coordinatorName: string;
      teamKey: string; // chave única (coordenador + time)
      teamName: string;
      members: TeamMemberInfoSerialized[];
    }[];
  }[];
};

export type TeamDataSerialized = TeamDataCoord | TeamDataRH;

