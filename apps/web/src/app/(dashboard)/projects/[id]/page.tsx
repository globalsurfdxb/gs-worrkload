"use client";

import { useEffect, useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Ban, ChevronLeft, ChevronRight, Pencil, Plus } from "lucide-react";
import { useParams, useRouter } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Priority, ProjectStatus, TaskStatus, type Department, type Team } from "@/lib/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api } from "@/lib/api-client";
import { cn } from "@/lib/utils";
import {
  PRIORITY_LABELS,
  PROJECT_STATUS_LABELS,
  TASK_STATUS_LABELS,
  TASK_STATUS_ORDER,
  formatDate,
  formatDateInput,
  healthScoreBadgeVariant,
  priorityBadgeVariant,
  projectStatusBadgeVariant,
  taskStatusBadgeVariant,
  taskStatusBarClass,
  toIsoDateTime,
} from "../_lib/project-ui";

const NO_TEAM = "none";

const editProjectFormSchema = z.object({
  departmentId: z.string().uuid("Select a department"),
  teamId: z.string().optional(),
  name: z.string().min(2, "Name is too short").max(200),
  description: z.string().max(5000).optional(),
  status: z.nativeEnum(ProjectStatus),
  priority: z.nativeEnum(Priority),
  startDate: z.string().optional(),
  dueDate: z.string().optional(),
  ownerId: z.string().uuid("Enter a valid owner UUID"),
});

type EditProjectFormValues = z.infer<typeof editProjectFormSchema>;

interface ProjectMilestone {
  id: string;
  projectId: string;
  name: string;
  dueDate?: string | null;
  isCompleted: boolean;
}

interface ProjectDetail {
  id: string;
  departmentId: string;
  teamId?: string | null;
  name: string;
  description?: string | null;
  status: ProjectStatus;
  priority: Priority;
  startDate?: string | null;
  dueDate?: string | null;
  healthScore: number;
  ownerId: string;
  department?: { id: string; name: string } | null;
  team?: { id: string; name: string } | null;
  owner?: { id: string; fullName: string; email: string } | null;
  milestones: ProjectMilestone[];
  tasksByStatus: Record<TaskStatus, number>;
}

interface TaskAssignee {
  userId: string;
  user: { id: string; fullName: string; email: string; avatarUrl?: string | null };
}

interface ProjectTask {
  id: string;
  projectId: string;
  milestoneId?: string | null;
  parentTaskId?: string | null;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: Priority;
  assignees: TaskAssignee[];
  watchersCount: number;
  subtasksCount: number;
  dueDate?: string | null;
  estimatedHours?: number | null;
  isRecurring: boolean;
}

interface TasksListResponse {
  data: ProjectTask[];
  meta: { total: number; page: number; pageSize: number; totalPages: number };
}

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>();
  const projectId = id;
  const router = useRouter();
  const queryClient = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [milestoneName, setMilestoneName] = useState("");
  const [milestoneDueDate, setMilestoneDueDate] = useState("");
  const [monthCursor, setMonthCursor] = useState(() => {
    const d = new Date();
    d.setDate(1);
    d.setHours(0, 0, 0, 0);
    return d;
  });

  const projectQuery = useQuery({
    queryKey: ["projects", projectId],
    queryFn: () => api.get<ProjectDetail>(`/projects/${projectId}`),
    enabled: !!projectId,
  });

  const tasksQuery = useQuery({
    queryKey: ["tasks", { projectId }],
    queryFn: () => api.get<TasksListResponse>(`/tasks?projectId=${projectId}&pageSize=200`),
    enabled: !!projectId,
  });

  const departmentsQuery = useQuery({
    queryKey: ["departments"],
    queryFn: () => api.get<Department[]>("/departments"),
  });

  const teamsQuery = useQuery({
    queryKey: ["teams"],
    queryFn: () => api.get<Team[]>("/teams"),
  });

  const tasks = tasksQuery.data?.data ?? [];

  const editForm = useForm<EditProjectFormValues>({
    resolver: zodResolver(editProjectFormSchema),
    defaultValues: {
      departmentId: "",
      teamId: NO_TEAM,
      name: "",
      description: "",
      status: ProjectStatus.PLANNING,
      priority: Priority.MEDIUM,
      startDate: "",
      dueDate: "",
      ownerId: "",
    },
  });

  useEffect(() => {
    if (editOpen && projectQuery.data) {
      const p = projectQuery.data;
      editForm.reset({
        departmentId: p.departmentId,
        teamId: p.teamId ?? NO_TEAM,
        name: p.name,
        description: p.description ?? "",
        status: p.status,
        priority: p.priority,
        startDate: formatDateInput(p.startDate),
        dueDate: formatDateInput(p.dueDate),
        ownerId: p.ownerId,
      });
    }
  }, [editOpen, projectQuery.data, editForm]);

  const selectedEditDepartmentId = editForm.watch("departmentId");
  const availableEditTeams = (teamsQuery.data ?? []).filter(
    (team) => !selectedEditDepartmentId || team.departmentId === selectedEditDepartmentId,
  );

  const updateMutation = useMutation({
    mutationFn: (payload: Record<string, unknown>) => api.patch(`/projects/${projectId}`, payload),
    onSuccess: () => {
      toast.success("Project updated");
      setEditOpen(false);
      queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof ApiError ? error.message : "Failed to update project.");
    },
  });

  const cancelMutation = useMutation({
    mutationFn: () => api.delete(`/projects/${projectId}`),
    onSuccess: () => {
      toast.success("Project cancelled");
      queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof ApiError ? error.message : "Failed to cancel project.");
    },
  });

  const createMilestoneMutation = useMutation({
    mutationFn: () =>
      api.post(`/projects/${projectId}/milestones`, {
        name: milestoneName.trim(),
        dueDate: toIsoDateTime(milestoneDueDate),
      }),
    onSuccess: () => {
      toast.success("Milestone added");
      setMilestoneName("");
      setMilestoneDueDate("");
      queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof ApiError ? error.message : "Failed to add milestone.");
    },
  });

  const toggleMilestoneMutation = useMutation({
    mutationFn: ({ milestoneId, isCompleted }: { milestoneId: string; isCompleted: boolean }) =>
      api.patch(`/projects/${projectId}/milestones/${milestoneId}`, { isCompleted }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects", projectId] });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof ApiError ? error.message : "Failed to update milestone.");
    },
  });

  const updateTaskStatusMutation = useMutation({
    mutationFn: ({ taskId, status }: { taskId: string; status: TaskStatus }) =>
      api.patch(`/tasks/${taskId}`, { status }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tasks", { projectId }] });
    },
    onError: (error: unknown) => {
      toast.error(error instanceof ApiError ? error.message : "Failed to move task.");
    },
  });

  const tasksByStatusList = useMemo(() => {
    const map = new Map<TaskStatus, ProjectTask[]>();
    for (const status of TASK_STATUS_ORDER) map.set(status, []);
    for (const task of tasks) {
      map.get(task.status)?.push(task);
    }
    return map;
  }, [tasks]);

  const calendarCells = useMemo(() => {
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    const firstWeekday = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const cells: Array<{ day: number } | null> = [];
    for (let i = 0; i < firstWeekday; i += 1) cells.push(null);
    for (let day = 1; day <= daysInMonth; day += 1) cells.push({ day });
    return cells;
  }, [monthCursor]);

  const tasksByDay = useMemo(() => {
    const map = new Map<number, ProjectTask[]>();
    const year = monthCursor.getFullYear();
    const month = monthCursor.getMonth();
    for (const task of tasks) {
      if (!task.dueDate) continue;
      const due = new Date(task.dueDate);
      if (due.getFullYear() === year && due.getMonth() === month) {
        const list = map.get(due.getDate()) ?? [];
        list.push(task);
        map.set(due.getDate(), list);
      }
    }
    return map;
  }, [tasks, monthCursor]);

  const timelineRange = useMemo(() => {
    const project = projectQuery.data;
    const dueTimes = tasks
      .map((t) => (t.dueDate ? new Date(t.dueDate).getTime() : null))
      .filter((t): t is number => t !== null && !Number.isNaN(t));

    const start = project?.startDate
      ? new Date(project.startDate).getTime()
      : dueTimes.length > 0
        ? Math.min(...dueTimes)
        : Date.now();

    const endCandidates = [
      ...(project?.dueDate ? [new Date(project.dueDate).getTime()] : []),
      ...dueTimes,
    ];
    let end = endCandidates.length > 0 ? Math.max(...endCandidates) : start + 30 * 24 * 60 * 60 * 1000;
    if (end <= start) end = start + 24 * 60 * 60 * 1000;

    return { start, end };
  }, [projectQuery.data, tasks]);

  const onEditSubmit = (values: EditProjectFormValues) => {
    updateMutation.mutate({
      departmentId: values.departmentId,
      teamId: values.teamId && values.teamId !== NO_TEAM ? values.teamId : undefined,
      name: values.name,
      description: values.description?.trim() ? values.description.trim() : undefined,
      status: values.status,
      priority: values.priority,
      startDate: toIsoDateTime(values.startDate),
      dueDate: toIsoDateTime(values.dueDate),
      ownerId: values.ownerId,
    });
  };

  const handleCancelProject = () => {
    if (window.confirm("Cancel this project? This action cannot be undone.")) {
      cancelMutation.mutate();
    }
  };

  if (projectQuery.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-10 w-80" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (projectQuery.isError || !projectQuery.data) {
    return <p className="text-sm text-destructive">Failed to load this project.</p>;
  }

  const project = projectQuery.data;

  return (
    <div className="flex flex-col gap-6">
      <Button variant="ghost" size="sm" className="w-fit" onClick={() => router.push("/projects")}>
        <ChevronLeft className="h-4 w-4" />
        Back to Projects
      </Button>

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold">{project.name}</h1>
            <Badge variant={projectStatusBadgeVariant(project.status)}>{PROJECT_STATUS_LABELS[project.status]}</Badge>
            <Badge variant={priorityBadgeVariant(project.priority)}>{PRIORITY_LABELS[project.priority]}</Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {project.department?.name ?? "—"}
            {project.team?.name ? ` • ${project.team.name}` : ""} • Owner: {project.owner?.fullName ?? project.ownerId}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Health</span>
            <Badge variant={healthScoreBadgeVariant(project.healthScore)}>{project.healthScore}</Badge>
          </div>
          <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
            <Pencil className="h-4 w-4" />
            Edit
          </Button>
          {project.status !== ProjectStatus.CANCELLED && (
            <Button variant="destructive" size="sm" onClick={handleCancelProject} disabled={cancelMutation.isPending}>
              <Ban className="h-4 w-4" />
              Cancel
            </Button>
          )}
        </div>
      </div>

      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Project</DialogTitle>
          </DialogHeader>
          <form className="flex flex-col gap-4" onSubmit={editForm.handleSubmit(onEditSubmit)}>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-departmentId">Department</Label>
                <Controller
                  control={editForm.control}
                  name="departmentId"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="edit-departmentId">
                        <SelectValue placeholder="Select department" />
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
                {editForm.formState.errors.departmentId && (
                  <p className="text-xs text-destructive">{editForm.formState.errors.departmentId.message}</p>
                )}
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-teamId">Team</Label>
                <Controller
                  control={editForm.control}
                  name="teamId"
                  render={({ field }) => (
                    <Select value={field.value ?? NO_TEAM} onValueChange={field.onChange}>
                      <SelectTrigger id="edit-teamId">
                        <SelectValue placeholder="No team" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={NO_TEAM}>No team</SelectItem>
                        {availableEditTeams.map((team) => (
                          <SelectItem key={team.id} value={team.id}>
                            {team.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-name">Project name</Label>
              <Input id="edit-name" {...editForm.register("name")} />
              {editForm.formState.errors.name && (
                <p className="text-xs text-destructive">{editForm.formState.errors.name.message}</p>
              )}
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-description">Description</Label>
              <Textarea id="edit-description" rows={3} {...editForm.register("description")} />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-status">Status</Label>
                <Controller
                  control={editForm.control}
                  name="status"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="edit-status">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(ProjectStatus).map((status) => (
                          <SelectItem key={status} value={status}>
                            {PROJECT_STATUS_LABELS[status]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-priority">Priority</Label>
                <Controller
                  control={editForm.control}
                  name="priority"
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="edit-priority">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(Priority).map((priority) => (
                          <SelectItem key={priority} value={priority}>
                            {PRIORITY_LABELS[priority]}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-startDate">Start date</Label>
                <Input id="edit-startDate" type="date" {...editForm.register("startDate")} />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="edit-dueDate">Due date</Label>
                <Input id="edit-dueDate" type="date" {...editForm.register("dueDate")} />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="edit-ownerId">Owner ID (UUID)</Label>
              <Input id="edit-ownerId" {...editForm.register("ownerId")} />
              {editForm.formState.errors.ownerId && (
                <p className="text-xs text-destructive">{editForm.formState.errors.ownerId.message}</p>
              )}
            </div>

            <DialogFooter>
              <Button type="submit" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="list">List</TabsTrigger>
          <TabsTrigger value="kanban">Kanban</TabsTrigger>
          <TabsTrigger value="calendar">Calendar</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Description</CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              {project.description || "No description provided."}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Tasks by Status</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-3">
              {TASK_STATUS_ORDER.map((status) => (
                <div key={status} className="flex min-w-[110px] flex-col gap-1 rounded-md border px-3 py-2">
                  <span className="text-xs text-muted-foreground">{TASK_STATUS_LABELS[status]}</span>
                  <span className="text-lg font-semibold">{project.tasksByStatus?.[status] ?? 0}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Milestones</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-4">
              {project.milestones.length === 0 ? (
                <p className="text-sm text-muted-foreground">No milestones yet.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {[...project.milestones]
                    .sort((a, b) => (a.dueDate ?? "").localeCompare(b.dueDate ?? ""))
                    .map((milestone) => (
                      <li
                        key={milestone.id}
                        className="flex items-center justify-between gap-3 rounded-md border px-3 py-2"
                      >
                        <label className="flex flex-1 items-center gap-2 text-sm">
                          <input
                            type="checkbox"
                            checked={milestone.isCompleted}
                            onChange={() =>
                              toggleMilestoneMutation.mutate({
                                milestoneId: milestone.id,
                                isCompleted: !milestone.isCompleted,
                              })
                            }
                            className="h-4 w-4 rounded border-input"
                          />
                          <span className={cn(milestone.isCompleted && "text-muted-foreground line-through")}>
                            {milestone.name}
                          </span>
                        </label>
                        <span className="text-xs text-muted-foreground">{formatDate(milestone.dueDate)}</span>
                      </li>
                    ))}
                </ul>
              )}

              <div className="flex flex-col gap-2 border-t pt-4 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <Label htmlFor="milestone-name" className="text-xs text-muted-foreground">
                    New milestone name
                  </Label>
                  <Input
                    id="milestone-name"
                    placeholder="e.g. Design sign-off"
                    value={milestoneName}
                    onChange={(e) => setMilestoneName(e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor="milestone-due" className="text-xs text-muted-foreground">
                    Due date
                  </Label>
                  <Input
                    id="milestone-due"
                    type="date"
                    value={milestoneDueDate}
                    onChange={(e) => setMilestoneDueDate(e.target.value)}
                  />
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={!milestoneName.trim() || createMilestoneMutation.isPending}
                  onClick={() => createMilestoneMutation.mutate()}
                >
                  <Plus className="h-4 w-4" />
                  Add
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="list">
          <Card>
            <CardContent className="p-0">
              {tasksQuery.isLoading ? (
                <div className="flex flex-col gap-2 p-6">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-10" />
                  ))}
                </div>
              ) : tasks.length === 0 ? (
                <p className="p-6 text-sm text-muted-foreground">No tasks on this project yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Title</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Priority</TableHead>
                      <TableHead>Assignees</TableHead>
                      <TableHead>Due Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {tasks.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell className="font-medium">{task.title}</TableCell>
                        <TableCell>
                          <Badge variant={taskStatusBadgeVariant(task.status)}>{TASK_STATUS_LABELS[task.status]}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant={priorityBadgeVariant(task.priority)}>{PRIORITY_LABELS[task.priority]}</Badge>
                        </TableCell>
                        <TableCell>
                          {task.assignees.length > 0
                            ? task.assignees.map((a) => a.user.fullName).join(", ")
                            : "Unassigned"}
                        </TableCell>
                        <TableCell>{formatDate(task.dueDate)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="kanban">
          <div className="flex gap-4 overflow-x-auto pb-2">
            {TASK_STATUS_ORDER.map((status) => {
              const columnTasks = tasksByStatusList.get(status) ?? [];
              return (
                <div
                  key={status}
                  className="flex min-w-[240px] flex-1 flex-col gap-2 rounded-lg border bg-muted/30 p-3"
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    const taskId = e.dataTransfer.getData("text/plain");
                    if (taskId) updateTaskStatusMutation.mutate({ taskId, status });
                  }}
                >
                  <div className="flex items-center justify-between px-1">
                    <span className="text-sm font-semibold">{TASK_STATUS_LABELS[status]}</span>
                    <Badge variant="muted">{columnTasks.length}</Badge>
                  </div>
                  <div className="flex flex-col gap-2">
                    {columnTasks.map((task) => (
                      <Card
                        key={task.id}
                        draggable
                        onDragStart={(e) => e.dataTransfer.setData("text/plain", task.id)}
                        className="cursor-grab p-3 active:cursor-grabbing"
                      >
                        <p className="text-sm font-medium">{task.title}</p>
                        <div className="mt-2 flex items-center justify-between gap-2">
                          <Badge variant={priorityBadgeVariant(task.priority)}>{PRIORITY_LABELS[task.priority]}</Badge>
                          <span className="text-xs text-muted-foreground">{formatDate(task.dueDate)}</span>
                        </div>
                      </Card>
                    ))}
                    {columnTasks.length === 0 && (
                      <p className="px-1 text-xs text-muted-foreground">No tasks</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        <TabsContent value="calendar" className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() - 1, 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              Prev
            </Button>
            <span className="text-sm font-semibold">
              {monthCursor.toLocaleDateString(undefined, { month: "long", year: "numeric" })}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMonthCursor((d) => new Date(d.getFullYear(), d.getMonth() + 1, 1))}
            >
              Next
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="grid grid-cols-7 gap-px overflow-hidden rounded-md border bg-border text-xs">
            {WEEKDAY_LABELS.map((label) => (
              <div key={label} className="bg-muted p-2 text-center font-medium text-muted-foreground">
                {label}
              </div>
            ))}
            {calendarCells.map((cell, idx) => (
              <div key={idx} className="min-h-[96px] bg-background p-1.5">
                {cell && (
                  <>
                    <span className="text-xs font-medium text-muted-foreground">{cell.day}</span>
                    <div className="mt-1 flex flex-col gap-1">
                      {(tasksByDay.get(cell.day) ?? []).map((task) => (
                        <span
                          key={task.id}
                          title={task.title}
                          className="truncate rounded bg-accent px-1 py-0.5 text-[11px] text-accent-foreground"
                        >
                          {task.title}
                        </span>
                      ))}
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="timeline" className="flex flex-col gap-3">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{formatDate(new Date(timelineRange.start).toISOString())}</span>
            <span>{formatDate(new Date(timelineRange.end).toISOString())}</span>
          </div>
          <div className="flex flex-col gap-2">
            {tasks.length === 0 ? (
              <p className="text-sm text-muted-foreground">No tasks to display.</p>
            ) : (
              tasks.map((task) => {
                const total = timelineRange.end - timelineRange.start || 1;
                const dueTime = task.dueDate ? new Date(task.dueDate).getTime() : null;
                const widthPct = dueTime
                  ? Math.min(100, Math.max(2, ((dueTime - timelineRange.start) / total) * 100))
                  : 0;
                return (
                  <div key={task.id} className="flex items-center gap-3">
                    <span className="w-40 shrink-0 truncate text-sm" title={task.title}>
                      {task.title}
                    </span>
                    <div className="relative h-6 flex-1 rounded bg-muted">
                      {dueTime ? (
                        <div
                          className={cn("absolute inset-y-0 left-0 rounded", taskStatusBarClass(task.status))}
                          style={{ width: `${widthPct}%` }}
                          title={`${task.title} — due ${formatDate(task.dueDate)}`}
                        />
                      ) : (
                        <span className="absolute inset-y-0 left-0 flex items-center px-2 text-xs text-muted-foreground">
                          No due date
                        </span>
                      )}
                    </div>
                    <span className="w-24 shrink-0 text-right text-xs text-muted-foreground">
                      {formatDate(task.dueDate)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
