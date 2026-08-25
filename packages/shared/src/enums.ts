// Enum values mirror apps/api/prisma/schema.prisma exactly — keep the two in sync.

export enum SystemRole {
  SUPER_ADMIN = "SUPER_ADMIN",
  DEPARTMENT_MANAGER = "DEPARTMENT_MANAGER",
  TEAM_LEAD = "TEAM_LEAD",
  EMPLOYEE = "EMPLOYEE",
  CLIENT = "CLIENT",
}

export enum ProjectStatus {
  PLANNING = "PLANNING",
  IN_PROGRESS = "IN_PROGRESS",
  ON_HOLD = "ON_HOLD",
  REVIEW = "REVIEW",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
}

export enum Priority {
  CRITICAL = "CRITICAL",
  HIGH = "HIGH",
  MEDIUM = "MEDIUM",
  LOW = "LOW",
}

export enum ProjectMethodology {
  AGILE = "AGILE",
  KANBAN = "KANBAN",
  WATERFALL = "WATERFALL",
}

export enum TaskStatus {
  BACKLOG = "BACKLOG",
  TODO = "TODO",
  IN_PROGRESS = "IN_PROGRESS",
  REVIEW = "REVIEW",
  TESTING = "TESTING",
  COMPLETED = "COMPLETED",
}

export enum TaskViewType {
  LIST = "LIST",
  KANBAN = "KANBAN",
  CALENDAR = "CALENDAR",
  TIMELINE = "TIMELINE",
  GANTT = "GANTT",
}

export enum ApprovalType {
  TIMESHEET = "TIMESHEET",
  LEAVE = "LEAVE",
  TASK = "TASK",
  CONTENT = "CONTENT",
  DESIGN = "DESIGN",
  PROJECT = "PROJECT",
}

export enum ApprovalStatus {
  DRAFT = "DRAFT",
  SUBMITTED = "SUBMITTED",
  PENDING = "PENDING",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

export enum TimesheetStatus {
  SUBMITTED = "SUBMITTED",
  PENDING_APPROVAL = "PENDING_APPROVAL",
  APPROVED = "APPROVED",
  REJECTED = "REJECTED",
}

export enum NotificationType {
  TASK_UPDATE = "TASK_UPDATE",
  PROJECT_UPDATE = "PROJECT_UPDATE",
  APPROVAL_REQUEST = "APPROVAL_REQUEST",
  DUE_DATE_REMINDER = "DUE_DATE_REMINDER",
  TEAM_ANNOUNCEMENT = "TEAM_ANNOUNCEMENT",
  MENTION = "MENTION",
}

export enum EmployeeAvailability {
  AVAILABLE = "AVAILABLE",
  PARTIALLY_AVAILABLE = "PARTIALLY_AVAILABLE",
  UNAVAILABLE = "UNAVAILABLE",
  ON_LEAVE = "ON_LEAVE",
}
