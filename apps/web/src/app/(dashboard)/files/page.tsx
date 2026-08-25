"use client";

import { useMemo, useRef, useState, type ChangeEvent } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { format } from "date-fns";
import { Download, FileText, History, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { SystemRole } from "@gs-workhub/shared";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
import { ApiError, api } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";

interface Attachment {
  id: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  blobPath: string;
  version: number;
  uploadedById: string;
  projectId: string | null;
  taskId: string | null;
  createdAt: string;
}

interface CreateUploadUrlResponse {
  attachmentId: string;
  uploadUrl: string;
  blobPath: string;
}

interface DownloadUrlResponse {
  downloadUrl: string;
  fileName: string;
  mimeType: string;
}

const FILES_QUERY_ROOT = ["files"] as const;
const DELETE_ROLES: SystemRole[] = [SystemRole.SUPER_ADMIN, SystemRole.DEPARTMENT_MANAGER, SystemRole.TEAM_LEAD];

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, exponent);
  const rounded = exponent === 0 ? String(Math.round(value)) : value.toFixed(1);
  return `${rounded} ${units[exponent]}`;
}

function formatUploadedBy(uploadedById: string): string {
  return uploadedById.length > 8 ? `${uploadedById.slice(0, 8)}…` : uploadedById;
}

export default function FilesPage() {
  const queryClient = useQueryClient();
  const role = useAuthStore((s) => s.user?.role);
  const canDelete = Boolean(role && DELETE_ROLES.includes(role));

  const [projectId, setProjectId] = useState("");
  const [taskId, setTaskId] = useState("");
  const [versionsFor, setVersionsFor] = useState<Attachment | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Attachment | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const trimmedProjectId = projectId.trim();
  const trimmedTaskId = taskId.trim();
  const hasScope = !!trimmedProjectId || !!trimmedTaskId;

  const handleProjectIdChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setProjectId(value);
    if (value.trim()) setTaskId("");
  };

  const handleTaskIdChange = (event: ChangeEvent<HTMLInputElement>) => {
    const value = event.target.value;
    setTaskId(value);
    if (value.trim()) setProjectId("");
  };

  const scopeQueryString = useMemo(() => {
    const params = new URLSearchParams();
    if (trimmedProjectId) params.set("projectId", trimmedProjectId);
    else if (trimmedTaskId) params.set("taskId", trimmedTaskId);
    return params.toString();
  }, [trimmedProjectId, trimmedTaskId]);

  const filesQuery = useQuery({
    queryKey: [...FILES_QUERY_ROOT, "list", trimmedProjectId, trimmedTaskId],
    queryFn: () => api.get<Attachment[]>(`/files?${scopeQueryString}`),
    enabled: hasScope,
  });

  const invalidateFiles = () => queryClient.invalidateQueries({ queryKey: FILES_QUERY_ROOT });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      const mimeType = file.type || "application/octet-stream";
      const uploadUrlRes = await api.post<CreateUploadUrlResponse>("/files/upload-url", {
        fileName: file.name,
        mimeType,
        sizeBytes: file.size,
        ...(trimmedProjectId ? { projectId: trimmedProjectId } : { taskId: trimmedTaskId }),
      });

      const putResponse = await fetch(uploadUrlRes.uploadUrl, {
        method: "PUT",
        headers: {
          "x-ms-blob-type": "BlockBlob",
          "Content-Type": mimeType,
        },
        body: file,
      });

      if (!putResponse.ok) {
        throw new Error(`Storage upload failed with status ${putResponse.status}`);
      }
    },
    onSuccess: () => {
      toast.success("File uploaded successfully.");
    },
    onError: (error: unknown) => {
      if (error instanceof ApiError) {
        toast.error(
          `Could not request an upload URL (${error.message}). The file entry may still have been recorded and will appear in the list.`,
        );
      } else {
        const message = error instanceof Error ? error.message : "Unknown error";
        toast.error(
          `File record was saved, but uploading the bytes to storage failed: ${message}. This is expected in a local environment without Azure Blob Storage configured.`,
        );
      }
    },
    onSettled: () => {
      invalidateFiles();
    },
  });

  const downloadMutation = useMutation({
    mutationFn: (id: string) => api.get<DownloadUrlResponse>(`/files/${id}/download-url`),
    onSuccess: (data) => {
      window.open(data.downloadUrl, "_blank");
    },
    onError: (error: unknown) => {
      toast.error(error instanceof ApiError ? error.message : "Failed to get a download link.");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/files/${id}`),
    onSuccess: () => {
      toast.success("File deleted.");
      setDeleteTarget(null);
      invalidateFiles();
    },
    onError: (error: unknown) => {
      toast.error(error instanceof ApiError ? error.message : "Failed to delete file.");
    },
  });

  const versionsQuery = useQuery({
    queryKey: [...FILES_QUERY_ROOT, "versions", versionsFor?.id],
    queryFn: () => api.get<Attachment[]>(`/files/${versionsFor?.id}/versions`),
    enabled: !!versionsFor,
  });

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (file) uploadMutation.mutate(file);
  };

  const files = filesQuery.data ?? [];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">File Management</h1>
          <p className="text-sm text-muted-foreground">
            Enter a project or task ID to view, upload, and manage its files.
          </p>
        </div>
        <div>
          <input ref={fileInputRef} type="file" className="hidden" onChange={handleFileChange} />
          <Button
            onClick={() => fileInputRef.current?.click()}
            disabled={!hasScope || uploadMutation.isPending}
          >
            <Upload className="h-4 w-4" />
            {uploadMutation.isPending ? "Uploading…" : "Upload File"}
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-end">
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="project-id">Project ID</Label>
            <Input
              id="project-id"
              value={projectId}
              onChange={handleProjectIdChange}
              placeholder="Paste a project UUID…"
              disabled={!!trimmedTaskId}
            />
          </div>
          <div className="flex-1 space-y-1.5">
            <Label htmlFor="task-id">Task ID</Label>
            <Input
              id="task-id"
              value={taskId}
              onChange={handleTaskIdChange}
              placeholder="Paste a task UUID…"
              disabled={!!trimmedProjectId}
            />
          </div>
        </CardContent>
      </Card>

      {!hasScope ? (
        <Card>
          <CardContent className="flex flex-col items-center gap-2 p-10 text-center text-sm text-muted-foreground">
            <FileText className="h-8 w-8" />
            Enter a project or task ID to view its files.
          </CardContent>
        </Card>
      ) : filesQuery.isLoading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-14" />
          ))}
        </div>
      ) : filesQuery.isError ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-destructive">
            {filesQuery.error instanceof ApiError
              ? filesQuery.error.message
              : "Failed to load files. Please try again."}
          </CardContent>
        </Card>
      ) : files.length === 0 ? (
        <Card>
          <CardContent className="p-10 text-center text-sm text-muted-foreground">
            No files found for this scope yet. Upload one to get started.
          </CardContent>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>File Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Size</TableHead>
                <TableHead>Version</TableHead>
                <TableHead>Uploaded By</TableHead>
                <TableHead>Uploaded</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {files.map((file) => (
                <TableRow key={file.id}>
                  <TableCell className="font-medium">{file.fileName}</TableCell>
                  <TableCell className="text-muted-foreground">{file.mimeType}</TableCell>
                  <TableCell className="text-muted-foreground">{formatBytes(file.sizeBytes)}</TableCell>
                  <TableCell>
                    <Badge variant="outline">v{file.version}</Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground" title={file.uploadedById}>
                    {formatUploadedBy(file.uploadedById)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {format(new Date(file.createdAt), "MMM d, yyyy")}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => downloadMutation.mutate(file.id)}
                        disabled={downloadMutation.isPending}
                        title="Download"
                      >
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setVersionsFor(file)}
                        title="Versions"
                      >
                        <History className="h-4 w-4" />
                      </Button>
                      {canDelete && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteTarget(file)}
                          title="Delete"
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}

      <Dialog open={!!versionsFor} onOpenChange={(open) => !open && setVersionsFor(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Version History</DialogTitle>
            <DialogDescription>{versionsFor?.fileName}</DialogDescription>
          </DialogHeader>

          {versionsQuery.isLoading ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-10" />
              ))}
            </div>
          ) : versionsQuery.isError ? (
            <p className="text-sm text-destructive">Failed to load version history.</p>
          ) : (
            <div className="flex flex-col gap-2">
              {(versionsQuery.data ?? []).map((version) => (
                <div
                  key={version.id}
                  className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline">v{version.version}</Badge>
                    <span className="text-muted-foreground">{formatBytes(version.sizeBytes)}</span>
                    <span className="text-muted-foreground">
                      {format(new Date(version.createdAt), "MMM d, yyyy")}
                    </span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => downloadMutation.mutate(version.id)}
                    disabled={downloadMutation.isPending}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete file?</DialogTitle>
            <DialogDescription>
              This will permanently delete &ldquo;{deleteTarget?.fileName}&rdquo; (v{deleteTarget?.version}). This
              action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.id)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "Deleting…" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
