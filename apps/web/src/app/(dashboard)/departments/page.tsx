"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { Building2, Users2 } from "lucide-react";
import type { Department } from "@/lib/shared";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api-client";

interface DepartmentListItem extends Department {
  teamCount: number;
  employeeCount: number;
}

export default function DepartmentsPage() {
  const { data, isLoading, isError } = useQuery({
    queryKey: ["departments"],
    queryFn: () => api.get<DepartmentListItem[]>("/departments"),
  });

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold">Departments</h1>
        <p className="text-sm text-muted-foreground">Browse departments across GlobalSurf.</p>
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40" />
          ))}
        </div>
      ) : isError ? (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Unable to load departments. Please try again later.
          </CardContent>
        </Card>
      ) : data && data.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((department) => (
            <Link key={department.id} href={`/departments/${department.id}`} className="block">
              <Card className="h-full transition-colors hover:border-primary/50 hover:shadow-md">
                <CardHeader className="flex flex-row items-start justify-between gap-2">
                  <div className="min-w-0">
                    <CardTitle className="truncate text-base">{department.name}</CardTitle>
                    <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
                      {department.description || "No description provided."}
                    </p>
                  </div>
                  <Badge variant="outline" className="shrink-0">
                    {department.code}
                  </Badge>
                </CardHeader>
                <CardContent className="flex items-center gap-4 pt-0 text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Users2 className="h-4 w-4" />
                    {department.teamCount} {department.teamCount === 1 ? "team" : "teams"}
                  </span>
                  <span className="flex items-center gap-1.5">
                    <Building2 className="h-4 w-4" />
                    {department.employeeCount} {department.employeeCount === 1 ? "employee" : "employees"}
                  </span>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      ) : (
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">No departments found.</CardContent>
        </Card>
      )}
    </div>
  );
}
