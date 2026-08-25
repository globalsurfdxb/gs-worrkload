"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Priority, TaskStatus } from "@gs-workhub/shared";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SheetTitle } from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { api, ApiError } from "@/lib/api-client";
import {
  formatDate,
  initials,
  PRIORITY_LABELS,
  PRIORITY_ORDER,
  statusBadgeVariant,
  TASK_STATUS_LABELS,
  TASK_STATUS_ORDER,
  type TaskDetail,
} from "./shared";

/**
 * Fetches and renders the full detail view for a single task. Meant to be rendered
 * inside a <Sheet><SheetContent>...</SheetContent></Sheet> by the caller — this
 * component only owns the content, not the slide-over shell itself.
 */
export function TaskDetailPanel({ taskId }: { taskId: string }) {
  const queryClient = useQueryClient();
  const [newAssigneeId, setNewAssigneeId] = useState("");
  const [commentBody, setCommentBody] = useState("");

  const taskQuery = useQuery({
    queryKey: ["tasks", "detail", taskId],
    queryFn: () => api.get<TaskDetail>(`/tasks/${taskId}`),
  });

  const invalidate = () => {
    // Broad invalidation: refreshes this task's detail plus the global list/kanban
    // query and any other task detail sheets that might be open.
    queryClient.invalidateQueries({ queryKey: ["tasks"] });
  };

  const statusMutation = useMutation({
    mutationFn: (status: TaskStatus) => api.patch(`/tasks/${taskId}`, { status }),
    onSuccess: () => {
      invalidate();
      toast.success("Status updated");
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Failed to update status"),
  });

  const priorityMutation = useMutation({
    mutationFn: (priority: Priority) => api.patch(`/tasks/${taskId}`, { priority }),
    onSuccess: () => {
      invalidate();
      toast.success("Priority updated");
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Failed to update priority"),
  });

  const addAssigneeMutation = useMutation({
    mutationFn: (userId: string) => api.post(`/tasks/${taskId}/assignees`, { userId }),
    onSuccess: () => {
      invalidate();
      setNewAssigneeId("");
      toast.success("Assignee added");
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Failed to add assignee"),
  });

  const addCommentMutation = useMutation({
    mutationFn: (body: string) => api.post(`/tasks/${taskId}/comments`, { body }),
    onSuccess: () => {
      invalidate();
      setCommentBody("");
    },
    onError: (error) =>
      toast.error(error instanceof ApiError ? error.message : "Failed to post comment"),
  });

  if (taskQuery.isLoading) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-6 w-2/3" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-9 w-full" />
        <Skeleton className="h-9 w-full" />
      </div>
    );
  }

  if (taskQuery.isError || !taskQuery.data) {
    return <p className="text-sm text-destructive">Unable to load this task.</p>;
  }

  const task = taskQuery.data;

  return (
    <div className="flex h-full flex-col gap-6 overflow-y-auto pb-4 pr-1">
      <div>
        <SheetTitle className="text-xl">{task.title}</SheetTitle>
        <p className="mt-2 whitespace-pre-wrap text-sm text-muted-foreground">
          {task.description || "No description provided."}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="flex flex-col gap-1.5">
          <Label>Status</Label>
          <Select
            value={task.status}
            onValueChange={(value) => statusMutation.mutate(value as TaskStatus)}
            disabled={statusMutation.isPending}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TASK_STATUS_ORDER.map((status) => (
                <SelectItem key={status} value={status}>
                  {TASK_STATUS_LABELS[status]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>Priority</Label>
          <Select
            value={task.priority}
            onValueChange={(value) => priorityMutation.mutate(value as Priority)}
            disabled={priorityMutation.isPending}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PRIORITY_ORDER.map((priority) => (
                <SelectItem key={priority} value={priority}>
                  {PRIORITY_LABELS[priority]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">Due date</span>
        <span className="font-medium">{formatDate(task.dueDate)}</span>
      </div>

      <Separator />

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">Assignees</h3>
        <div className="flex flex-col gap-2">
          {task.assignees.length === 0 && (
            <p className="text-sm text-muted-foreground">No one is assigned yet.</p>
          )}
          {task.assignees.map((assignee) => (
            <div key={assignee.id} className="flex items-center gap-2">
              <Avatar className="h-7 w-7">
                <AvatarFallback>{initials(assignee.user.fullName)}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col leading-tight">
                <span className="text-sm font-medium">{assignee.user.fullName}</span>
                <span className="text-xs text-muted-foreground">{assignee.user.email}</span>
              </div>
            </div>
          ))}
        </div>
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (newAssigneeId.trim()) addAssigneeMutation.mutate(newAssigneeId.trim());
          }}
        >
          <Input
            placeholder="Add assignee by user ID (UUID)"
            value={newAssigneeId}
            onChange={(e) => setNewAssigneeId(e.target.value)}
          />
          <Button type="submit" variant="outline" disabled={addAssigneeMutation.isPending}>
            Add
          </Button>
        </form>
      </div>

      <Separator />

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">Subtasks ({task.subtasks.length})</h3>
        {task.subtasks.length === 0 ? (
          <p className="text-sm text-muted-foreground">No subtasks.</p>
        ) : (
          <div className="flex flex-col gap-2">
            {task.subtasks.map((subtask) => (
              <div
                key={subtask.id}
                className="flex items-center justify-between rounded-md border px-3 py-2"
              >
                <span className="text-sm">{subtask.title}</span>
                <Badge variant={statusBadgeVariant(subtask.status)}>
                  {TASK_STATUS_LABELS[subtask.status]}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>

      <Separator />

      <div className="flex flex-col gap-3">
        <h3 className="text-sm font-semibold">Comments ({task.comments.length})</h3>
        <div className="flex flex-col gap-3">
          {task.comments.length === 0 && (
            <p className="text-sm text-muted-foreground">No comments yet.</p>
          )}
          {task.comments.map((comment) => (
            <div key={comment.id} className="rounded-md border p-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">{comment.author.fullName}</span>
                <span className="text-xs text-muted-foreground">
                  {new Date(comment.createdAt).toLocaleString()}
                </span>
              </div>
              <p className="mt-1 whitespace-pre-wrap text-sm">{comment.body}</p>
            </div>
          ))}
        </div>
        <form
          className="flex flex-col gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (commentBody.trim()) addCommentMutation.mutate(commentBody.trim());
          }}
        >
          <Textarea
            placeholder="Write a comment…"
            value={commentBody}
            onChange={(e) => setCommentBody(e.target.value)}
          />
          <Button type="submit" className="self-end" disabled={addCommentMutation.isPending}>
            Post
          </Button>
        </form>
      </div>

      <Separator />

      <div className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold">Recent Activity</h3>
        {task.activityEntries.length === 0 ? (
          <p className="text-sm text-muted-foreground">No activity recorded yet.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {task.activityEntries.map((entry) => (
              <p key={entry.id} className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{entry.field}</span>:{" "}
                {entry.oldValue ?? "—"} → {entry.newValue ?? "—"}{" "}
                <span className="opacity-70">({new Date(entry.createdAt).toLocaleString()})</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
