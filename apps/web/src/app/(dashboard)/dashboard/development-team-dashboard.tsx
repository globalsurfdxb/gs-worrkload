"use client";

import { format } from "date-fns";
import type { Team } from "@/lib/shared";
import { Badge } from "@/components/ui/badge";
import { DevOverviewTab } from "./dev-overview-tab";

/**
 * The Development team's view of the main Dashboard: delivery metrics and
 * portfolio health (Module 11 — Development Team). Sprint tracking and bug
 * tracking live on their own pages now (`/sprints`, `/bugs`), matching how
 * Tasks/Projects are their own nav items rather than dashboard tabs.
 *
 * Rendered by `DashboardPage` only for the Development team's Team Lead; see
 * the `useDevTeamAccess` hook in `@/lib/dev-shared`.
 */
export function DevelopmentTeamDashboard({ team }: { team: Team }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Development Dashboard</h1>
          <p className="text-sm text-muted-foreground">
            {team.name} — real-time overview of development projects, performance and delivery
          </p>
        </div>
        <Badge variant="muted" className="w-fit">
          {format(new Date(), "MMMM yyyy")} (MTD)
        </Badge>
      </div>

      <DevOverviewTab teamId={team.id} />
    </div>
  );
}
