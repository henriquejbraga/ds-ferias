import { getRoleLevel } from "@/lib/vacationRules";
import { TimesViewClient } from "@/components/times-view-client";
import { IconTeams } from "@/components/layout/icons";
import type { TeamDataForTimes } from "@/types/dashboard";

export function TimesView({
  userRole,
  userId,
  teamData,
}: {
  userRole: string;
  userId: string;
  teamData: TeamDataForTimes | null;
}) {
  const level = getRoleLevel(userRole);

  if (!teamData) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#e2e8f0] bg-white px-8 py-12 text-center dark:border-[#252a35] dark:bg-[#1a1d23]">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#f5f6f8] dark:bg-[#252a35]">
          <IconTeams />
        </div>
        <p className="text-lg font-semibold text-[#1a1d23] dark:text-white">Carregando times...</p>
      </div>
    );
  }

  const totalMembers =
    teamData.kind === "coord"
      ? teamData.teams.reduce((s, t) => s + t.members.length, 0)
      : teamData.gerentes.reduce((s, g) => s + g.teams.reduce((s2, t) => s2 + t.members.length, 0), 0);

  if (totalMembers === 0) {
    return (
      <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-[#e2e8f0] bg-white px-8 py-12 text-center dark:border-[#252a35] dark:bg-[#1a1d23]">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#f5f6f8] dark:bg-[#252a35]">
          <IconTeams />
        </div>
        <p className="text-lg font-semibold text-[#1a1d23] dark:text-white">Nenhum colaborador no time</p>
        <p className="mt-2 max-w-md text-base text-[#64748b] dark:text-slate-400">
          {level === 2
            ? "Você ainda não tem reportes diretos. Colaboradores aparecerão aqui quando estiverem vinculados a você no Backoffice."
            : "Não há colaboradores nos times sob sua visão no momento."}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {level === 2 && (
        <p className="text-sm text-[#64748b] dark:text-slate-400">
          Todos os colaboradores do seu time, com status de férias explícito. Use o filtro e expanda ou recolha cada time.
        </p>
      )}
      {level === 3 && (
        <p className="text-sm text-[#64748b] dark:text-slate-400">
          Férias dos times sob sua gestão, organizadas por coordenador(a). Filtre por nome ou status e expanda os times para ver os colaboradores.
        </p>
      )}
      {teamData.kind === "rh" && (
        <p className="text-sm text-[#64748b] dark:text-slate-400">
          Todos os times por gerente e coordenador(a). Filtre e expanda cada gerente ou time para facilitar a navegação.
        </p>
      )}
      <TimesViewClient teamData={teamData as Parameters<typeof TimesViewClient>[0]["teamData"]} userId={userId} userRole={userRole} level={level} />
    </div>
  );
}
