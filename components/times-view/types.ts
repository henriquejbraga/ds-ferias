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
  /** Nível de indentação no calendário (0 = raiz, 1 = indentado, etc) */
  calendarLevel?: number;
  /** Chave única da linha para controle de árvore */
  calendarRowKey?: string;
  /** Chave da linha pai para controle de visibilidade */
  calendarParentRowKey?: string;
  /** Indica se a linha é um nó que pode ser expandido */
  calendarIsBranch?: boolean;
};

export type TeamDataCoord = {
  kind: "coord";
  coordinatorSelf?: TeamMemberInfoSerialized;
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
    diretorId?: string | null;
    diretorName?: string | null;
    gerenteSelf?: TeamMemberInfoSerialized;
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

