"use client";

import { useState } from "react";
import type { TeamDataSerialized, TeamMemberInfoSerialized } from "./types";
import { matchesFilter } from "./filters";
import { TimesViewFilterBar } from "./TimesViewFilterBar";
import { TimesViewCoordTeamsList } from "./TimesViewCoordTeamsList";
import { TimesViewRhTeamsList } from "./TimesViewRhTeamsList";

type Props = {
  teamData: TeamDataSerialized;
  userId: string;
  userRole: string;
  level: number;
};

export function TimesViewClient({ teamData }: Props) {
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("TODOS");
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const toggle = (key: string) => {
    setExpanded((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const filterMembers = (members: TeamMemberInfoSerialized[]) => members.filter((m) => matchesFilter(m, query, statusFilter));

  if (teamData.kind === "coord") {
    const teamsFiltered = teamData.teams
      .map((team) => ({ ...team, members: filterMembers(team.members) }))
      .filter((t) => t.members.length > 0);

    return (
      <div className="space-y-6">
        <TimesViewFilterBar query={query} setQuery={setQuery} statusFilter={statusFilter} setStatusFilter={setStatusFilter} />
        <TimesViewCoordTeamsList teams={teamsFiltered} expanded={expanded} toggle={toggle} />
      </div>
    );
  }

  const gerentesFiltered = teamData.gerentes
    .map((g) => ({
      ...g,
      teams: g.teams
        .map((team) => ({ ...team, members: filterMembers(team.members) }))
        .filter((t) => t.members.length > 0),
    }))
    .filter((g) => g.teams.length > 0);

  return (
    <div className="space-y-6">
      <TimesViewFilterBar query={query} setQuery={setQuery} statusFilter={statusFilter} setStatusFilter={setStatusFilter} />
      <TimesViewRhTeamsList gerentes={gerentesFiltered} expanded={expanded} toggle={toggle} />
    </div>
  );
}

