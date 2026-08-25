"use client";

import { useQuery } from "@tanstack/react-query";
import { Building2, CheckCircle2, FolderKanban, Users } from "lucide-react";
import { SystemRole } from "@/lib/shared";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";
import { useDevTeamAccess } from "@/lib/dev-shared";
import { useAuthStore } from "@/store/auth-store";
import { DevelopmentTeamDashboard } from "./development-team-dashboard";

interface CompanyReport {
  totalProjects: number;
  activeProjects: number;
  completedProjects: number;
  totalEmployees: number;
  departmentPerformance: { departmentId: string; name: string; completionRate: number }[];
  resourceUtilizationPct: number;
}

interface DepartmentReport {
  activeProjects: number;
  activeTasks: number;
  overdueTasks: number;
  teamProductivity: number;
  utilizationPct: number;
}

function StatCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string | number;
  icon: typeof Users;
}) {
  return (
    <Card>
      <CardContent className="flex items-center justify-between p-6">
        <div>
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold">{value}</p>
        </div>
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-foreground">
          <Icon className="h-5 w-5" />
        </div>
      </CardContent>
    </Card>
  );
}

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const isCompanyView = user?.role === SystemRole.SUPER_ADMIN;

  const companyQuery = useQuery({
    queryKey: ["reports", "company"],
    queryFn: () => api.get<CompanyReport>("/reports/company"),
    enabled: isCompanyView,
  });

  const departmentQuery = useQuery({
    queryKey: ["reports", "department", user?.departmentId],
    queryFn: () => api.get<DepartmentReport>(`/reports/departments/${user?.departmentId}`),
    enabled: !isCompanyView && !!user?.departmentId,
  });

  // Development team resolution + the Team-Lead-only access gate are shared
  // with the standalone /sprints and /bugs pages — see `useDevTeamAccess`.
  const { devTeam, isDevTeamLead, isPending: devLookupPending } = useDevTeamAccess();

  const loading = isCompanyView ? companyQuery.isLoading : departmentQuery.isLoading;

  if (isDevTeamLead && devTeam) {
    return <DevelopmentTeamDashboard team={devTeam} />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Welcome back{user?.fullName ? `, ${user.fullName.split(" ")[0]}` : ""}</h1>
        <p className="text-sm text-muted-foreground">
          {isCompanyView ? "Company-wide overview" : "Your department overview"}
        </p>
      </div>

      {loading || devLookupPending ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
      ) : isCompanyView && companyQuery.data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Total Projects" value={companyQuery.data.totalProjects} icon={FolderKanban} />
          <StatCard label="Active Projects" value={companyQuery.data.activeProjects} icon={FolderKanban} />
          <StatCard label="Completed Projects" value={companyQuery.data.completedProjects} icon={CheckCircle2} />
          <StatCard label="Total Employees" value={companyQuery.data.totalEmployees} icon={Users} />
        </div>
      ) : departmentQuery.data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard label="Active Projects" value={departmentQuery.data.activeProjects} icon={FolderKanban} />
          <StatCard label="Active Tasks" value={departmentQuery.data.activeTasks} icon={CheckCircle2} />
          <StatCard label="Overdue Tasks" value={departmentQuery.data.overdueTasks} icon={Building2} />
          <StatCard label="Utilization" value={`${Math.round(departmentQuery.data.utilizationPct)}%`} icon={Users} />
        </div>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>No department assigned</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            Ask your administrator to assign you to a department to see dashboard metrics.
          </CardContent>
        </Card>
      )}

      {isCompanyView && companyQuery.data && (
        <Card>
          <CardHeader>
            <CardTitle>Department Performance</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            {companyQuery.data.departmentPerformance.map((dept) => (
              <div key={dept.departmentId} className="flex items-center justify-between text-sm">
                <span>{dept.name}</span>
                <span className="font-medium">{Math.round(dept.completionRate)}% complete</span>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
