import { RequestCard, type RequestWithUser } from "@/components/requests/request-card";

function groupByManager(requests: RequestWithUser[]): Record<string, RequestWithUser[]> {
  return requests.reduce((groups: Record<string, RequestWithUser[]>, r) => {
    const name = r.user?.manager?.name ?? "Sem coordenador definido";
    if (!groups[name]) groups[name] = [];
    groups[name].push(r);
    return groups;
  }, {});
}

export function RequestsGroupedByManager({
  requests,
  userId,
  userRole,
}: {
  requests: RequestWithUser[];
  userId: string;
  userRole: string;
}) {
  const groups = groupByManager(requests);
  return (
    <div className="space-y-5">
      {Object.entries(groups).map(([managerName, groupReqs]) => (
        <section key={managerName} className="space-y-3">
          <div className="flex items-center gap-2 rounded-md bg-[#f5f6f8] px-4 py-2.5 dark:bg-[#1e2330]">
            <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-100 text-sm font-bold text-indigo-700 dark:bg-indigo-900/40 dark:text-indigo-300">
              {managerName.charAt(0).toUpperCase()}
            </span>
            <h3 className="text-base font-semibold text-[#1a1d23] dark:text-white">
              Coordenador(a): {managerName}
            </h3>
            <span className="ml-auto text-sm text-[#64748b]">{groupReqs.length} solicitação(ões)</span>
          </div>
          {groupReqs.map((r) => (
            <RequestCard key={r.id} request={r} userId={userId} userRole={userRole} />
          ))}
        </section>
      ))}
    </div>
  );
}
