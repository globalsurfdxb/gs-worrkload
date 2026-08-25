# GS WorkHub — Database ERD

Source of truth: [`apps/api/prisma/schema.prisma`](../apps/api/prisma/schema.prisma). This document is the rendered view of that file — if the two ever disagree, the Prisma schema wins and this diagram should be regenerated from it.

## 1. Entity-Relationship Diagram

```mermaid
erDiagram
    ORGANIZATION ||--o{ DEPARTMENT : has
    DEPARTMENT ||--o{ TEAM : has
    DEPARTMENT ||--o{ USER : employs
    DEPARTMENT ||--o{ PROJECT : owns
    DEPARTMENT ||--o| USER : "managed by"
    DEPARTMENT ||--o{ KPI_SNAPSHOT : tracks

    TEAM ||--o{ TEAM_MEMBER : has
    TEAM ||--o| USER : "led by"
    TEAM ||--o{ PROJECT : runs
    TEAM ||--o{ KPI_SNAPSHOT : tracks
    USER ||--o{ TEAM_MEMBER : "member of"

    USER ||--o{ REFRESH_TOKEN : owns
    USER ||--o{ PROJECT : owns
    USER ||--o{ TASK_ASSIGNEE : "assigned via"
    USER ||--o{ TASK_WATCHER : "watches via"
    USER ||--o{ COMMENT : writes
    USER ||--o{ TIMESHEET_ENTRY : logs
    USER ||--o{ APPROVAL_REQUEST : requests
    USER ||--o{ APPROVAL_REQUEST : decides
    USER ||--o{ NOTIFICATION : receives
    USER ||--o{ ATTACHMENT : uploads
    USER ||--o{ AUDIT_LOG : performs

    PROJECT ||--o{ MILESTONE : has
    PROJECT ||--o{ TASK : contains
    PROJECT ||--o{ ATTACHMENT : has
    PROJECT ||--o{ APPROVAL_REQUEST : "may require"

    MILESTONE ||--o{ TASK : groups

    TASK ||--o{ TASK : "subtasks (self)"
    TASK ||--o{ TASK_ASSIGNEE : has
    TASK ||--o{ TASK_WATCHER : has
    TASK ||--o{ COMMENT : has
    TASK ||--o{ ATTACHMENT : has
    TASK ||--o{ ACTIVITY_LOG_ENTRY : has
    TASK ||--o{ TIMESHEET_ENTRY : logged_against
    TASK ||--o{ TASK_DEPENDENCY : "depends on (self, via join)"

    TIMESHEET_ENTRY ||--o| APPROVAL_REQUEST : "submitted as"

    ORGANIZATION {
        uuid id PK
        string name
    }
    DEPARTMENT {
        uuid id PK
        uuid organizationId FK
        string name
        string code "unique"
        uuid managerId FK
        bool isArchived
    }
    TEAM {
        uuid id PK
        uuid departmentId FK
        string name
        string code "unique"
        uuid teamLeadId FK
        float capacityHoursPerWeek
        bool isArchived
    }
    TEAM_MEMBER {
        uuid id PK
        uuid teamId FK
        uuid userId FK
    }
    USER {
        uuid id PK
        string fullName
        string email "unique"
        string passwordHash
        enum role "SystemRole"
        string designation
        string[] skills
        enum availability "EmployeeAvailability"
        float capacityHoursPerWeek
        uuid departmentId FK
        bool isActive
    }
    REFRESH_TOKEN {
        uuid id PK
        uuid userId FK
        string tokenHash "unique"
        datetime expiresAt
        datetime revokedAt
    }
    PROJECT {
        uuid id PK
        uuid departmentId FK
        uuid teamId FK
        string name
        enum status "ProjectStatus"
        enum priority "Priority"
        datetime startDate
        datetime dueDate
        int healthScore
        uuid ownerId FK
    }
    MILESTONE {
        uuid id PK
        uuid projectId FK
        string name
        datetime dueDate
        bool isCompleted
    }
    TASK {
        uuid id PK
        uuid projectId FK
        uuid milestoneId FK
        uuid parentTaskId FK
        string title
        enum status "TaskStatus"
        enum priority "Priority"
        datetime dueDate
        float estimatedHours
        bool isRecurring
    }
    TASK_ASSIGNEE {
        uuid id PK
        uuid taskId FK
        uuid userId FK
    }
    TASK_WATCHER {
        uuid id PK
        uuid taskId FK
        uuid userId FK
    }
    TASK_DEPENDENCY {
        uuid id PK
        uuid dependentTaskId FK
        uuid prerequisiteTaskId FK
    }
    COMMENT {
        uuid id PK
        uuid taskId FK
        uuid authorId FK
        string body
    }
    ACTIVITY_LOG_ENTRY {
        uuid id PK
        uuid taskId FK
        uuid actorId
        string field
        string oldValue
        string newValue
    }
    ATTACHMENT {
        uuid id PK
        string fileName
        string blobPath
        int version
        uuid uploadedById FK
        uuid projectId FK
        uuid taskId FK
    }
    TIMESHEET_ENTRY {
        uuid id PK
        uuid employeeId FK
        uuid taskId FK
        uuid projectId FK
        datetime date
        float hours
        enum status "TimesheetStatus"
    }
    APPROVAL_REQUEST {
        uuid id PK
        enum type "ApprovalType"
        enum status "ApprovalStatus"
        uuid requesterId FK
        uuid approverId FK
        uuid timesheetEntryId FK "unique"
        uuid projectId FK
        string entityLabel
    }
    NOTIFICATION {
        uuid id PK
        uuid userId FK
        enum type "NotificationType"
        string title
        bool isRead
    }
    KPI_SNAPSHOT {
        uuid id PK
        uuid departmentId FK
        uuid teamId FK
        datetime snapshotDate
        float taskCompletionRate
        float productivityScore
        float utilizationPct
        float slaCompliancePct
    }
    AUDIT_LOG {
        uuid id PK
        uuid actorId FK
        string action
        string entityType
        string entityId
        json metadata
    }
```

## 2. Enum Reference

| Enum | Values |
|---|---|
| `SystemRole` | `SUPER_ADMIN`, `DEPARTMENT_MANAGER`, `TEAM_LEAD`, `EMPLOYEE`, `CLIENT` |
| `EmployeeAvailability` | `AVAILABLE`, `PARTIALLY_AVAILABLE`, `UNAVAILABLE`, `ON_LEAVE` |
| `ProjectStatus` | `PLANNING`, `IN_PROGRESS`, `ON_HOLD`, `REVIEW`, `COMPLETED`, `CANCELLED` |
| `Priority` | `CRITICAL`, `HIGH`, `MEDIUM`, `LOW` |
| `TaskStatus` | `BACKLOG`, `TODO`, `IN_PROGRESS`, `REVIEW`, `TESTING`, `COMPLETED` |
| `TimesheetStatus` | `SUBMITTED`, `PENDING_APPROVAL`, `APPROVED`, `REJECTED` |
| `ApprovalType` | `TIMESHEET`, `LEAVE`, `TASK`, `CONTENT`, `DESIGN`, `PROJECT` |
| `ApprovalStatus` | `DRAFT`, `SUBMITTED`, `PENDING`, `APPROVED`, `REJECTED` |
| `NotificationType` | `TASK_UPDATE`, `PROJECT_UPDATE`, `APPROVAL_REQUEST`, `DUE_DATE_REMINDER`, `TEAM_ANNOUNCEMENT`, `MENTION` |

These are mirrored (by value, not by shared code) in `packages/shared/src/enums.ts` for frontend use.

## 3. Design Notes

- **UUID primary keys** everywhere (`@default(uuid())`) rather than auto-increment integers — safe to generate client-side, don't leak row counts, and avoid collisions if data is ever merged across environments.
- **`Approval` is a generic resource**, not one table per approval type. `ApprovalRequest.type` discriminates; `timesheetEntryId` and `projectId` are the only two typed FKs (timesheet approvals and project approvals are the two flows with a concrete linked record today). Leave/Task/Content/Design approvals use the free-text `entityLabel` field. This trades a little type safety for one dashboard/API surface across every approval kind — revisit if a specific approval type grows enough custom fields to earn its own table.
- **Task subtasks** are the same `Task` table via a self-relation (`parentTaskId`) rather than a separate `Subtask` table — a subtask is a task with a parent, full stop, so it can have its own subtasks, assignees, comments, etc. without a parallel schema.
- **Task dependencies** are a many-to-many join (`TaskDependency`) rather than a single `blockedBy` column, so a task can depend on multiple prerequisites.
- **Attachments carry `version` as a plain integer**, with a new row per version rather than a mutable "latest" row — full version history without a separate history table.
- **Department/Team `code`** is unique and human-assigned (e.g. `DIGITAL-DEV`) — used in seed data, URLs, and integration references, distinct from the internal UUID `id`.
- **No soft-delete flag on every table** — only entities with a real archival concept (`Department.isArchived`, `Team.isArchived`, `User.isActive`, `Project.status = CANCELLED`) support "remove without deleting." Tasks/comments/timesheets are hard-deleted where the module logic allows it, since they don't carry cross-module references the way an org unit does.
