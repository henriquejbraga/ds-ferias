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
};

export type TeamDataCoord = {
  kind: "coord";
  teams: { coordinatorId: string; coordinatorName: string; members: TeamMemberInfoSerialized[] }[];
};

export type TeamDataRH = {
  kind: "rh";
  gerentes: {
    gerenteId: string;
    gerenteName: string;
    teams: { coordinatorId: string; coordinatorName: string; members: TeamMemberInfoSerialized[] }[];
  }[];
};

export type TeamDataSerialized = TeamDataCoord | TeamDataRH;

