"use client";

import { useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Pencil, UserX } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import {
  EmployeeAvailability,
  SystemRole,
  type Department,
  type Priority,
  type ProjectStatus,
  type TaskStatus,
  type TimesheetStatus,
} from "@gs-workhub/shared";
import { EMPLOYEE_AVAILABILITY_LABELS, availabilityBadgeVariant, formatDate, initials } from "../shared";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { api, ApiError } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";

interface EmployeeProfile {
  id: string;
  fullName: string;
  email: string;
  role: SystemRole;
  designation?: string | null;
  skills: string[];
  availability: EmployeeAvailability;
  capacityHoursPerWeek: number;
  avatarUrl?: string | null;
  departmentId?: string | null;
  isActive: boolean;
  department?: Department | null;
}

interface WorkHistoryTask {
  id: string;
  title: string;
  status: TaskStatus;
  priority: Priority;
  dueDate?: string | null;
  project?: { id: string; name: string; status: ProjectStatus } | null;
}

interface WorkHistoryProject {
  id: string;
  name: string;
  status: ProjectStatus;
  priority: Priority;
  startDate?: string | null;
  dueDate?: string | null;
  healthScore: number;
}

interface WorkHistoryTimesheetEntry {
  id: string;
  date: string;
  hours: number;
  notes?: string | null;
  status: TimesheetStatus;
}

interface WorkHistory {
  assignedTasks: WorkHistoryTask[];
  ownedProjects: WorkHistoryProject[];
  recentTimesheetEntries: WorkHistoryTimesheetEntry[];
}

const ROLE_LABEL: Record<SystemRole, string> = {
  [SystemRole.SUPER_ADMIN]: "Super Admin",
  [SystemRole.DEPARTMENT_MANAGER]: "Department Manager",
  [SystemRole.TEAM_LEAD]: "Team Lead",
  [SystemRole.EMPLOYEE]: "Employee",
  [SystemRole.CLIENT]: "Client",
};

const NO_DEPARTMENT = "__none__";

const editEmployeeSchema = z.object({
  designation: z.string().trim().max(200).optional(),
  skillsInput: z.string().trim().max(500).optional(),
  availability: z.nativeEnum(EmployeeAvailability),
  capacityHoursPerWeek: z.coerce
    .number({ invalid_type_error: "Enter a number" })
    .min(0, "Must be 0 or greater")
    .max(500, "Must be 500 or less"),
  role: z.nativeEnum(SystemRole),
  departmentId: z.string(),
});
type EditEmployeeFormValues = z.infer<typeof editEmployeeSchema>;

export default function EmployeeProfilePage() {
  const params = useParams<{ id: string }>();
  const employeeId = params.id;
  const router = useRouter();
  const queryClient = useQueryClient();
  const currentUser = useAuthStore((s) => s.user);
  const canManage =
    currentUser?.role === SystemRole.SUPER_ADMIN || currentUser?.role === SystemRole.DEPARTMENT_MANAGER;
  const isSuperAdmin = currentUser?.role === SystemRole.SUPER_ADMIN;

  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isDeactivateOpen, setIsDeactivateOpen] = useState(false);

  const profileQuery = useQuery({
    queryKey: ["employees", employeeId],
    queryFn: () => api.get<EmployeeProfile>(`/employees/${employeeId}`),
    enabled: !!employeeId,
  });

  const departmentsQuery = useQuery({
    queryKey: ["departments"],
    queryFn: () => api.get<Department[]>("/departments"),
    enabled: isSuperAdmin,
  });

  const workHistoryQuery = useQuery({
    queryKey: ["employees", employeeId, "work-history"],
    queryFn: () => api.get<WorkHistory>(`/employees/${employeeId}/work-history`),
    enabled: !!employeeId,
  });

  const form = useForm<EditEmployeeFormValues>({
    resolver: zodResolver(editEmployeeSchema),
    values: profileQuery.data
      ? {
          designation: profileQuery.data.designation ?? "",
          skillsInput: profileQuery.data.skills.join(", "),
          availability: profileQuery.data.availability,
          capacityHoursPerWeek: profileQuery.data.capacityHoursPerWeek,
          role: profileQuery.data.role,
          departmentId: profileQuery.data.departmentId ?? NO_DEPARTMENT,
        }
      : undefined,
  });

  const updateMutation = useMutation({
    mutationFn: (values: EditEmployeeFormValues) =>
      api.patch<EmployeeProfile>(`/employees/${employeeId}`, {
        designation: values.designation ?? "",
        skills: values.skillsInput
          ? values.skillsInput
              .split(",")
              .map((skill) => skill.trim())
              .filter(Boolean)
          : [],
        availability: values.availability,
        capacityHoursPerWeek: values.capacityHoursPerWeek,
        // Role and department reassignment are UI-gated to Super Admin only
        // (the API also accepts these from Department Managers, but moving
        // someone across departments or granting a higher role is an
        // org-wide action we don't expose to that role in this UI).
        ...(isSuperAdmin ? { role: values.role } : {}),
        // The API's departmentId field only accepts a UUID (no way to
        // unassign via this endpoint) — only send it when a real
        // department was chosen, otherwise leave it unchanged.
        ...(isSuperAdmin && values.departmentId !== NO_DEPARTMENT
          ? { departmentId: values.departmentId }
          : {}),
      }),
    onSuccess: () => {
      toast.success("Employee profile updated.");
      setIsEditOpen(false);
      queryClient.invalidateQueries({ queryKey: ["employees"] });
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Failed to update employee.");
    },
  });

  const deactivateMutation = useMutation({
    mutationFn: () => api.delete(`/employees/${employeeId}`),
    onSuccess: () => {
      toast.success("Employee deactivated.");
      setIsDeactivateOpen(false);
      queryClient.invalidateQueries({ queryKey: ["employees"] });
      router.push("/employees");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Failed to deactivate employee.");
    },
  });

  if (profileQuery.isLoading) {
    return (
      <div className="flex flex-col gap-6">
        <Skeleton className="h-32" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (profileQuery.isError || !profileQuery.data) {
    return (
      <Card>
        <CardContent className="p-10 text-center text-sm text-destructive">
          Failed to load this employee. They may not exist or you may not have access.
        </CardContent>
      </Card>
    );
  }

  const employee = profileQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" onClick={() => router.push("/employees")}>
        <ArrowLeft className="h-4 w-4" />
        Back to directory
      </Button>

      <Card>
        <CardContent className="flex flex-col gap-4 p-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-4">
            <Avatar className="h-16 w-16">
              {employee.avatarUrl ? <AvatarImage src={employee.avatarUrl} alt={employee.fullName} /> : null}
              <AvatarFallback className="text-lg">{initials(employee.fullName)}</AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-semibold">{employee.fullName}</h1>
              <p className="text-sm text-muted-foreground">{employee.designation ?? "No designation"}</p>
              <p className="text-sm text-muted-foreground">{employee.email}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2">
                <Badge variant="outline">{ROLE_LABEL[employee.role]}</Badge>
                <Badge variant={availabilityBadgeVariant(employee.availability)}>
                  {EMPLOYEE_AVAILABILITY_LABELS[employee.availability]}
                </Badge>
                {!employee.isActive && <Badge variant="destructive">Deactivated</Badge>}
                {employee.department && <Badge variant="secondary">{employee.department.name}</Badge>}
              </div>
            </div>
          </div>

          {canManage && (
            <div className="flex shrink-0 gap-2">
              <Button variant="outline" size="sm" onClick={() => setIsEditOpen(true)}>
                <Pencil className="h-4 w-4" />
                Edit
              </Button>
              {employee.isActive && (
                <Button variant="destructive" size="sm" onClick={() => setIsDeactivateOpen(true)}>
                  <UserX className="h-4 w-4" />
                  Deactivate
                </Button>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Skills</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            {employee.skills.length > 0 ? (
              employee.skills.map((skill) => (
                <Badge key={skill} variant="secondary">
                  {skill}
                </Badge>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No skills recorded.</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Capacity</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{employee.capacityHoursPerWeek} hrs/week</p>
            <p className="text-sm text-muted-foreground">Standard availability commitment.</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Work History</CardTitle>
        </CardHeader>
        <CardContent>
          {workHistoryQuery.isLoading ? (
            <Skeleton className="h-40" />
          ) : workHistoryQuery.isError || !workHistoryQuery.data ? (
            <p className="text-sm text-destructive">Failed to load work history.</p>
          ) : (
            <Tabs defaultValue="tasks">
              <TabsList>
                <TabsTrigger value="tasks">
                  Assigned Tasks ({workHistoryQuery.data.assignedTasks.length})
                </TabsTrigger>
                <TabsTrigger value="projects">
                  Owned Projects ({workHistoryQuery.data.ownedProjects.length})
                </TabsTrigger>
                <TabsTrigger value="timesheets">
                  Timesheets ({workHistoryQuery.data.recentTimesheetEntries.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="tasks">
                {workHistoryQuery.data.assignedTasks.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No task assignments.</p>
                ) : (
                  <div className="flex flex-col divide-y">
                    {workHistoryQuery.data.assignedTasks.map((task) => (
                      <div key={task.id} className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{task.title}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            {task.project?.name ?? "No project"} · Due {formatDate(task.dueDate)}
                          </p>
                        </div>
                        <Badge variant="outline">{task.status.replaceAll("_", " ")}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="projects">
                {workHistoryQuery.data.ownedProjects.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No owned projects.</p>
                ) : (
                  <div className="flex flex-col divide-y">
                    {workHistoryQuery.data.ownedProjects.map((project) => (
                      <div key={project.id} className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{project.name}</p>
                          <p className="truncate text-xs text-muted-foreground">
                            Due {formatDate(project.dueDate)} · Health {project.healthScore}
                          </p>
                        </div>
                        <Badge variant="outline">{project.status.replaceAll("_", " ")}</Badge>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>

              <TabsContent value="timesheets">
                {workHistoryQuery.data.recentTimesheetEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No timesheet entries in the last 90 days.</p>
                ) : (
                  <div className="flex flex-col divide-y">
                    {workHistoryQuery.data.recentTimesheetEntries.map((entry) => (
                      <div key={entry.id} className="flex items-center justify-between gap-3 py-3">
                        <div className="min-w-0">
                          <p className="truncate font-medium">{formatDate(entry.date)}</p>
                          <p className="truncate text-xs text-muted-foreground">{entry.notes ?? "No notes"}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">{entry.hours}h</span>
                          <Badge variant="outline">{entry.status.replaceAll("_", " ")}</Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>

      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
            <DialogDescription>Update {employee.fullName}&apos;s profile details.</DialogDescription>
          </DialogHeader>
          <form
            className="flex flex-col gap-4"
            onSubmit={form.handleSubmit((values) => updateMutation.mutate(values))}
          >
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="designation">Designation</Label>
              <Input id="designation" placeholder="e.g. Senior Engineer" {...form.register("designation")} />
              {form.formState.errors.designation && (
                <p className="text-xs text-destructive">{form.formState.errors.designation.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="skills">Skills</Label>
              <Input id="skills" placeholder="Comma-separated, e.g. React, Node.js" {...form.register("skillsInput")} />
              {form.formState.errors.skillsInput && (
                <p className="text-xs text-destructive">{form.formState.errors.skillsInput.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="availability">Availability</Label>
              <Controller
                control={form.control}
                name="availability"
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger id="availability">
                      <SelectValue placeholder="Select availability" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.values(EmployeeAvailability).map((value) => (
                        <SelectItem key={value} value={value}>
                          {EMPLOYEE_AVAILABILITY_LABELS[value]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="capacityHoursPerWeek">Capacity (hours/week)</Label>
              <Input
                id="capacityHoursPerWeek"
                type="number"
                min={0}
                max={500}
                step="1"
                {...form.register("capacityHoursPerWeek")}
              />
              {form.formState.errors.capacityHoursPerWeek && (
                <p className="text-xs text-destructive">{form.formState.errors.capacityHoursPerWeek.message}</p>
              )}
            </div>

            {isSuperAdmin && (
              <>
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="role">Role</Label>
                  <Controller
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="role">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          {Object.values(SystemRole).map((role) => (
                            <SelectItem key={role} value={role}>
                              {ROLE_LABEL[role]}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                  <p className="text-xs text-muted-foreground">
                    Controls what this person can see and do across GS WorkHub.
                  </p>
                </div>

                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="departmentId">Department</Label>
                  <Controller
                    control={form.control}
                    name="departmentId"
                    render={({ field }) => (
                      <Select value={field.value} onValueChange={field.onChange}>
                        <SelectTrigger id="departmentId">
                          <SelectValue placeholder="No department assigned" />
                        </SelectTrigger>
                        <SelectContent>
                          {(departmentsQuery.data ?? []).map((dept) => (
                            <SelectItem key={dept.id} value={dept.id}>
                              {dept.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  />
                </div>
              </>
            )}

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsEditOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={isDeactivateOpen} onOpenChange={setIsDeactivateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Deactivate employee?</DialogTitle>
            <DialogDescription>
              {employee.fullName} will be marked inactive and removed from the active directory. This can be
              reversed by an administrator via the API.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsDeactivateOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deactivateMutation.isPending}
              onClick={() => deactivateMutation.mutate()}
            >
              {deactivateMutation.isPending ? "Deactivating…" : "Deactivate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
