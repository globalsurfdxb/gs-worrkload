"use client";

import { useEffect, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, ArchiveRestore, Pencil, Plus, ShieldAlert } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { createDepartmentSchema, type CreateDepartmentInput, type Department } from "@gs-workhub/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";

interface DepartmentListItem extends Department {
  teamCount: number;
  employeeCount: number;
}

type DialogState = { mode: "create" } | { mode: "edit"; department: DepartmentListItem } | null;

function DepartmentFormDialog({
  state,
  onOpenChange,
}: {
  state: DialogState;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const editingDepartment = state?.mode === "edit" ? state.department : null;
  const isEdit = editingDepartment !== null;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CreateDepartmentInput>({
    resolver: zodResolver(createDepartmentSchema),
    defaultValues: editingDepartment
      ? {
          name: editingDepartment.name,
          code: editingDepartment.code,
          description: editingDepartment.description ?? "",
        }
      : { name: "", code: "", description: "" },
  });

  useEffect(() => {
    if (editingDepartment) {
      reset({
        name: editingDepartment.name,
        code: editingDepartment.code,
        description: editingDepartment.description ?? "",
      });
    } else if (state?.mode === "create") {
      reset({ name: "", code: "", description: "" });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, reset]);

  const mutation = useMutation({
    mutationFn: (values: CreateDepartmentInput) => {
      if (editingDepartment) {
        return api.patch(`/departments/${editingDepartment.id}`, {
          name: values.name,
          description: values.description || undefined,
        });
      }
      return api.post("/departments", {
        name: values.name,
        code: values.code,
        description: values.description || undefined,
      });
    },
    onSuccess: () => {
      toast.success(isEdit ? "Department updated." : "Department created.");
      queryClient.invalidateQueries({ queryKey: ["departments"] });
      onOpenChange(false);
    },
    onError: (error: unknown) => {
      toast.error(
        error instanceof ApiError ? error.message : "Something went wrong. Please try again.",
      );
    },
  });

  return (
    <Dialog open={state !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit department" : "Create department"}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? "Update the department's details below."
              : "Add a new department to the organization directory."}
          </DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-4"
          onSubmit={handleSubmit((values) => mutation.mutate(values))}
        >
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="name">Name</Label>
            <Input id="name" placeholder="e.g. Creative Studio" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="code">Code</Label>
            <Input
              id="code"
              placeholder="e.g. CRTV"
              disabled={isEdit}
              {...register("code")}
            />
            {isEdit ? (
              <p className="text-xs text-muted-foreground">Department code cannot be changed after creation.</p>
            ) : (
              <p className="text-xs text-muted-foreground">Uppercase letters, numbers, - or _ only.</p>
            )}
            {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              placeholder="What does this department do?"
              {...register("description")}
            />
            {errors.description && (
              <p className="text-xs text-destructive">{errors.description.message}</p>
            )}
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? "Saving…" : isEdit ? "Save changes" : "Create department"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default function AdminDepartmentsPage() {
  const user = useAuthStore((s) => s.user);
  const isSuperAdmin = user?.role === "SUPER_ADMIN";
  const queryClient = useQueryClient();
  const [dialogState, setDialogState] = useState<DialogState>(null);

  const departmentsQuery = useQuery({
    queryKey: ["departments", "admin"],
    queryFn: () => api.get<DepartmentListItem[]>("/departments?includeArchived=true"),
    enabled: isSuperAdmin,
  });

  const archiveMutation = useMutation({
    mutationFn: ({ id, archive }: { id: string; archive: boolean }) =>
      api.patch(`/departments/${id}/${archive ? "archive" : "unarchive"}`),
    onSuccess: (_data, variables) => {
      toast.success(variables.archive ? "Department archived." : "Department unarchived.");
      queryClient.invalidateQueries({ queryKey: ["departments"] });
    },
    onError: (error: unknown) => {
      toast.error(
        error instanceof ApiError ? error.message : "Unable to update department status.",
      );
    },
  });

  if (!isSuperAdmin) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
          <ShieldAlert className="h-8 w-8 text-muted-foreground" />
          <CardTitle className="text-base">Access denied</CardTitle>
          <p className="text-sm text-muted-foreground">
            Only Super Admins can manage departments. Contact your administrator if you believe you
            should have access.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Manage Departments</h1>
          <p className="text-sm text-muted-foreground">
            Create, edit, and archive departments across the organization.
          </p>
        </div>
        <Button onClick={() => setDialogState({ mode: "create" })}>
          <Plus className="h-4 w-4" /> Create Department
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">All departments</CardTitle>
        </CardHeader>
        <CardContent>
          {departmentsQuery.isLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : departmentsQuery.isError ? (
            <p className="text-sm text-muted-foreground">Unable to load departments.</p>
          ) : departmentsQuery.data && departmentsQuery.data.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Teams</TableHead>
                  <TableHead>Employees</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {departmentsQuery.data.map((department) => (
                  <TableRow key={department.id}>
                    <TableCell className="font-medium">{department.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline">{department.code}</Badge>
                    </TableCell>
                    <TableCell>{department.teamCount}</TableCell>
                    <TableCell>{department.employeeCount}</TableCell>
                    <TableCell>
                      {department.isArchived ? (
                        <Badge variant="muted">Archived</Badge>
                      ) : (
                        <Badge variant="success">Active</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={`Edit ${department.name}`}
                          onClick={() => setDialogState({ mode: "edit", department })}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          aria-label={department.isArchived ? `Unarchive ${department.name}` : `Archive ${department.name}`}
                          disabled={archiveMutation.isPending}
                          onClick={() =>
                            archiveMutation.mutate({ id: department.id, archive: !department.isArchived })
                          }
                        >
                          {department.isArchived ? (
                            <ArchiveRestore className="h-4 w-4" />
                          ) : (
                            <Archive className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-sm text-muted-foreground">No departments found.</p>
          )}
        </CardContent>
      </Card>

      <DepartmentFormDialog
        state={dialogState}
        onOpenChange={(open) => {
          if (!open) setDialogState(null);
        }}
      />
    </div>
  );
}
