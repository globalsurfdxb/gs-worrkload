"use client";

import { useQuery } from "@tanstack/react-query";
import {
  ArrowDownRight,
  ArrowUpRight,
  Bug,
  CheckCircle2,
  Clock,
  FolderKanban,
  ListChecks,
  Users,
} from "lucide-react";
import { AreaLineChart } from "@/components/charts/AreaLineChart";
import { BarChart } from "@/components/charts/BarChart";
import { DonutChart, type DonutSegment } from "@/components/charts/DonutChart";
import { Gauge } from "@/components/charts/Gauge";
import { Sparkline } from "@/components/charts/Sparkline";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  PRIORITY_COLORS,
  PRIORITY_LABELS,
  PRIORITY_ORDER,
  PROJECT_STATUS_COLORS,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_ORDER,
  type DevDashboard,
  type DevStat,
} from "@/lib/dev-shared";

// ─────────────────────────────────────────────────────────────────────────────
// Pieces
// ─────────────────────────────────────────────────────────────────────────────

function StatCard({
  label,
  stat,
  icon: Icon,
  suffix,
  higherIsBetter = true,
}: {
  label: string;
  stat: DevStat;
  icon: typeof Users;
  suffix?: string;
  /** Drives the delta colour — up is good for delivery, bad for bugs. */
  higherIsBetter?: boolean;
}) {
  const rising = stat.deltaPct > 0;
  const flat = stat.deltaPct === 0;
  const improving = higherIsBetter ? rising : !rising;
  const DeltaIcon = rising ? ArrowUpRight : ArrowDownRight;

  return (
    <Card>
      <CardContent className="flex flex-col gap-3 p-5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium text-muted-foreground">{label}</p>
          <Icon className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </div>

        <p className="text-2xl font-semibold tabular-nums">
          {stat.value}
          {suffix}
        </p>

        <div className="flex items-end justify-between gap-2">
          {flat ? (
            <span className="text-xs text-muted-foreground">No change</span>
          ) : (
            <span
              className={cn(
                "flex items-center gap-0.5 text-xs font-medium",
                improving ? "text-success" : "text-destructive",
              )}
            >
              <DeltaIcon className="h-3.5 w-3.5" aria-hidden="true" />
              {Math.abs(stat.deltaPct)}%
            </span>
          )}
          <Sparkline
            data={stat.trend}
            color={improving ? "hsl(var(--primary))" : "hsl(var(--destructive))"}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function SprintMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-baseline justify-between gap-3 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-semibold tabular-nums">{value}</span>
    </div>
  );
}

function BugMetric({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <div className="rounded-md border border-border p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={cn("mt-1 text-xl font-semibold tabular-nums", tone)}>{value}</p>
    </div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col gap-6">
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="h-32" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <Skeleton key={index} className="h-72" />
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <Skeleton key={index} className="h-72" />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Tab
// ─────────────────────────────────────────────────────────────────────────────

export function DevOverviewTab({ teamId }: { teamId: string }) {
  const dashboardQuery = useQuery({
    queryKey: ["dev-dashboard", teamId],
    queryFn: () => api.get<DevDashboard>(`/teams/${teamId}/dev-dashboard?days=30`),
    enabled: !!teamId,
  });

  if (dashboardQuery.isError) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Dashboard unavailable</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          We could not load the Development team&apos;s metrics. Please refresh the page and try
          again.
        </CardContent>
      </Card>
    );
  }

  const data = dashboardQuery.data;
  if (!data) return <LoadingState />;

  const projectSegments: DonutSegment[] = PROJECT_STATUS_ORDER.flatMap((status) => {
    const row = data.projectsByStatus.find((item) => item.status === status);
    if (!row) return [];
    return [
      {
        label: PROJECT_STATUS_LABELS[status],
        value: row.count,
        color: PROJECT_STATUS_COLORS[status],
      },
    ];
  });

  const prioritySegments: DonutSegment[] = PRIORITY_ORDER.flatMap((priority) => {
    const row = data.tasksByPriority.find((item) => item.priority === priority);
    if (!row) return [];
    return [
      {
        label: PRIORITY_LABELS[priority],
        value: row.count,
        color: PRIORITY_COLORS[priority],
      },
    ];
  });

  const sprint = data.currentSprint;

  return (
    <div className="flex flex-col gap-6">
      {/* ── Headline stats ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <StatCard label="Active Projects" stat={data.stats.activeProjects} icon={FolderKanban} />
        <StatCard label="Tasks In Progress" stat={data.stats.tasksInProgress} icon={ListChecks} />
        <StatCard label="Tasks Completed" stat={data.stats.tasksCompleted} icon={CheckCircle2} />
        <StatCard
          label="On-time Delivery"
          stat={data.stats.onTimeDeliveryPct}
          icon={Clock}
          suffix="%"
        />
        <StatCard
          label="Bugs (This Month)"
          stat={data.stats.bugsThisMonth}
          icon={Bug}
          higherIsBetter={false}
        />
        <StatCard
          label="Team Utilization"
          stat={data.stats.teamUtilizationPct}
          icon={Users}
          suffix="%"
        />
      </div>

      {/* ── Portfolio, sprint, priorities ──────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>Projects by Status</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart data={projectSegments} centerLabel="Projects" size={150} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle>Sprint Progress</CardTitle>
            {sprint && (
              <Badge variant={sprint.daysLeft <= 2 ? "warning" : "muted"}>
                {sprint.daysLeft} {sprint.daysLeft === 1 ? "Day" : "Days"} Left
              </Badge>
            )}
          </CardHeader>
          <CardContent>
            {sprint ? (
              <div className="flex flex-col gap-4">
                <Gauge value={sprint.completionPct} label="Completed" />
                <div className="flex flex-col gap-2 border-t border-border pt-3">
                  <p className="text-sm font-medium">{sprint.name}</p>
                  <SprintMetric label="Total tasks" value={sprint.totalTasks} />
                  <SprintMetric label="Completed" value={sprint.completed} />
                  <SprintMetric label="In Progress" value={sprint.inProgress} />
                  <SprintMetric label="To Do" value={sprint.todo} />
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">No active sprint.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Tasks by Priority</CardTitle>
          </CardHeader>
          <CardContent>
            <DonutChart data={prioritySegments} centerLabel="Open" size={150} />
          </CardContent>
        </Card>
      </div>

      {/* ── Velocity + bugs ────────────────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex-row items-start justify-between gap-2 space-y-0">
            <div className="flex flex-col gap-1.5">
              <CardTitle>Velocity (Story Points)</CardTitle>
              <p className="text-sm text-muted-foreground">
                Completed points per sprint, last {data.velocity.length} sprints
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-muted-foreground">Average</p>
              <p className="text-lg font-semibold tabular-nums">{data.averageVelocity}</p>
            </div>
          </CardHeader>
          <CardContent>
            <BarChart
              data={data.velocity.map((entry) => ({
                // "Sprint 22" → "S22" so six labels fit without wrapping.
                label: entry.sprintName.replace("Sprint ", "S"),
                value: entry.points,
              }))}
              averageValue={data.averageVelocity}
              unit="pts"
            />
            <p className="mt-3 text-xs text-muted-foreground">
              Dashed line marks the {data.averageVelocity}-point average.
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Bugs Over Time</CardTitle>
            <p className="text-sm text-muted-foreground">
              Defects raised per day over the last {data.periodDays} days
            </p>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <AreaLineChart
              data={data.bugsOverTime.map((point) => ({ date: point.date, value: point.count }))}
              unit="bugs"
              height={180}
            />
            <div className="grid grid-cols-3 gap-3">
              <BugMetric label="Total" value={data.bugSummary.total} />
              <BugMetric label="Resolved" value={data.bugSummary.resolved} tone="text-success" />
              <BugMetric label="Open" value={data.bugSummary.open} tone="text-destructive" />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
