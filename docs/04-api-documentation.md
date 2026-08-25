# GS WorkHub — API Documentation

Base URL: `{API_URL}/api/v1` (global prefix set in `apps/api/src/main.ts`). All routes require `Authorization: Bearer <accessToken>` unless marked **Public**. Roles listed are the *minimum* required beyond "any authenticated user"; department/team/own-record scoping described in `03-rbac-matrix.md` applies on top of the role check for every list/read endpoint.

## Auth (`/auth`)

| Method | Path | Roles | Description |
|---|---|---|---|
| POST | `/auth/login` | Public | `{ email, password }` → `{ accessToken, refreshToken, user }` |
| POST | `/auth/refresh` | Public | `{ refreshToken }` → new rotated `{ accessToken, refreshToken }` |
| POST | `/auth/logout` | Public | `{ refreshToken }` → revokes it (204) |

## Employees (`/employees`) — Module 1

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/employees` | any | Directory. Filters: `departmentId, teamId, skill, availability, search, page, pageSize` |
| GET | `/employees/:id` | any (own dept/self) | Full profile incl. department, teams, skills, availability |
| POST | `/employees` | SUPER_ADMIN, DEPARTMENT_MANAGER | Create account (bcrypt-hashed password) |
| PATCH | `/employees/:id` | SUPER_ADMIN, DEPARTMENT_MANAGER | Update designation/skills/availability/capacity/department/role |
| DELETE | `/employees/:id` | SUPER_ADMIN, DEPARTMENT_MANAGER | Soft-deactivate (`isActive=false`) |
| GET | `/employees/:id/work-history` | any (own dept/self) | Assigned tasks + owned projects + recent timesheet entries |

## Departments (`/departments`) — Module 2

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/departments` | any | List with team/employee counts |
| GET | `/departments/:id` | any (own dept) | Detail + dashboard block |
| POST | `/departments` | SUPER_ADMIN | Create |
| PATCH | `/departments/:id` | SUPER_ADMIN, DEPARTMENT_MANAGER | Edit (department-scoped on `id`) |
| PATCH | `/departments/:id/archive` | SUPER_ADMIN | Archive (no hard delete) |
| PATCH | `/departments/:id/unarchive` | SUPER_ADMIN | Restore |
| GET | `/departments/:id/resource-allocation` | SUPER_ADMIN, DEPARTMENT_MANAGER | Team/employee capacity rollup |
| GET | `/departments/:id/kpis` | SUPER_ADMIN, DEPARTMENT_MANAGER | Last 12 `KpiSnapshot` rows |

## Teams (`/teams`) — Module 3

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/teams` | any | Filters `departmentId, includeArchived` |
| GET | `/teams/:id` | any (own dept/team) | Detail incl. members, lead, active projects |
| POST | `/teams` | SUPER_ADMIN, DEPARTMENT_MANAGER | Create (department-scoped) |
| PATCH | `/teams/:id` | SUPER_ADMIN, DEPARTMENT_MANAGER, TEAM_LEAD | Edit |
| PATCH | `/teams/:id/archive` / `/unarchive` | SUPER_ADMIN, DEPARTMENT_MANAGER | Toggle archive |
| POST | `/teams/:id/members` | SUPER_ADMIN, DEPARTMENT_MANAGER, TEAM_LEAD | Add member `{ userId }` |
| DELETE | `/teams/:id/members/:userId` | SUPER_ADMIN, DEPARTMENT_MANAGER, TEAM_LEAD | Remove member |
| GET | `/teams/:id/capacity` | any | `{ capacityHoursPerWeek, memberCount, capacityPerMember }` |
| GET | `/teams/:id/workload` | any | Per-member allocated vs. capacity |

## Projects (`/projects`, `/project-templates`) — Module 4

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/projects` | any (own dept) | Filters `departmentId, teamId, status, priority, ownerId, search, page, pageSize` |
| GET | `/projects/:id` | any (own dept) | Detail + task counts by status |
| POST | `/projects` | any (department-scoped) | Create |
| PATCH | `/projects/:id` | any (own dept) | Edit |
| DELETE | `/projects/:id` | any (own dept) | Sets `status=CANCELLED` |
| GET | `/projects/:id/health` | any (own dept) | Recomputes + persists `healthScore` |
| GET/POST/PATCH/DELETE | `/projects/:id/milestones[/:milestoneId]` | any (own dept) | Milestone CRUD |
| GET | `/project-templates` | any | List templates |
| POST | `/project-templates` | SUPER_ADMIN, DEPARTMENT_MANAGER | Create template |
| POST | `/projects/from-template/:templateId` | any (department-scoped) | Instantiate project + milestones |

## Tasks (`/tasks`) — Module 5

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/tasks` | any | Filters `projectId, milestoneId, parentTaskId, assigneeId, status, priority, dueBefore, dueAfter, search, page, pageSize` |
| GET | `/tasks/:id` | any | Full detail incl. subtasks, comments, dependencies, activity log, attachments |
| POST | `/tasks` | any | Create (optional `assigneeIds[]`, `watcherIds[]`) |
| PATCH | `/tasks/:id` | any | Update; diffed `status/priority/dueDate` changes recorded to activity log |
| DELETE | `/tasks/:id` | any | Hard delete (rejected if subtasks exist) |
| POST/DELETE | `/tasks/:id/assignees[/:userId]` | any | Manage assignees |
| POST/DELETE | `/tasks/:id/watchers[/:userId]` | any | Manage watchers |
| GET/POST | `/tasks/:id/comments` | any | Comment thread |
| POST/DELETE | `/tasks/:id/dependencies[/:dependencyId]` | any | Manage prerequisite links (cycle-checked) |

## Workload (`/workload`) — Module 6 (read-only)

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/workload/employees` | any | Filters `departmentId, teamId`; per-employee capacity/allocation/utilization |
| GET | `/workload/teams/:teamId` | any | Team rollup + per-member breakdown |
| GET | `/workload/departments/:departmentId` | any | Department rollup |
| GET | `/workload/overloaded` | any | Employees over 100% utilization |
| GET | `/workload/underutilized` | any | Employees under 60% utilization |

## Timesheets (`/timesheets`) — Module 7

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/timesheets` | any (own unless manager/lead/admin) | Filters `employeeId, projectId, taskId, dateFrom, dateTo, status` |
| GET | `/timesheets/:id` | any (own/manager) | Detail |
| POST | `/timesheets` | any | Create entry (`employeeId` always = caller) |
| PATCH | `/timesheets/:id` | own, while SUBMITTED | Edit hours/notes/date |
| DELETE | `/timesheets/:id` | own, while SUBMITTED | Delete |
| POST | `/timesheets/:id/submit-for-approval` | own | → `PENDING_APPROVAL` + creates `ApprovalRequest` |
| GET | `/timesheets/reports/employee/:employeeId` | any (own/manager) | Hours report |
| GET | `/timesheets/reports/team/:teamId` | any (own/manager) | Hours report |
| GET | `/timesheets/reports/department/:departmentId` | SUPER_ADMIN, DEPARTMENT_MANAGER | Hours report |
| GET | `/timesheets/reports/project/:projectId` | any (own dept) | Hours report |

## Approvals (`/approvals`) — Module 8

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/approvals` | any (own unless manager/lead/admin) | Filters `requesterId, approverId, type, status, pendingForMe` |
| GET | `/approvals/:id` | any (own/manager) | Detail |
| POST | `/approvals` | any | Create (LEAVE/TASK/CONTENT/DESIGN/PROJECT — not TIMESHEET, use the timesheet endpoint) |
| POST | `/approvals/:id/approve` | SUPER_ADMIN, DEPARTMENT_MANAGER, TEAM_LEAD | Approve (+ syncs linked timesheet entry) |
| POST | `/approvals/:id/reject` | SUPER_ADMIN, DEPARTMENT_MANAGER, TEAM_LEAD | Reject (comment required) |

## Notifications (`/notifications` + WS `/notifications`) — Module 9

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/notifications` | any | Own notifications, `?unreadOnly=true` |
| PATCH | `/notifications/:id/read` | any (own) | Mark one read |
| PATCH | `/notifications/read-all` | any | Mark all read |
| WS event `notification` | namespace `/notifications` | any | Realtime push; client authenticates via `handshake.auth.token` (JWT access token) |

## Files (`/files`) — Module 10

| Method | Path | Roles | Description |
|---|---|---|---|
| POST | `/files/upload-url` | any (own task/project) | Returns short-lived SAS write URL + creates `Attachment` row |
| GET | `/files/:id/download-url` | any (own dept/assigned) | Short-lived SAS read URL |
| GET | `/files` | any | Filters `projectId` or `taskId` |
| GET | `/files/:id/versions` | any | All versions of a file |
| DELETE | `/files/:id` | SUPER_ADMIN, DEPARTMENT_MANAGER, TEAM_LEAD | Deletes blob + row |

## Reports (`/reports`) — Module 13

| Method | Path | Roles | Description |
|---|---|---|---|
| GET | `/reports/company` | SUPER_ADMIN | Company-wide dashboard numbers |
| GET | `/reports/departments/:id` | SUPER_ADMIN, DEPARTMENT_MANAGER | Department dashboard |
| GET | `/reports/teams/:id` | any (own dept/team) | Team dashboard |
| GET | `/reports/kpis` | SUPER_ADMIN, DEPARTMENT_MANAGER | Historical KPI snapshots |
| POST | `/reports/kpis/snapshot` | SUPER_ADMIN, DEPARTMENT_MANAGER | Compute + persist a new snapshot |

## Error shape

Every error response (from `GlobalExceptionFilter`) has the shape:

```json
{
  "statusCode": 403,
  "path": "/api/v1/departments/…/archive",
  "timestamp": "2026-08-18T09:00:00.000Z",
  "message": "You do not have access to this department's data."
}
```

## Pagination convention

List endpoints that support it accept `page` (1-based, default 1) and `pageSize` (default 20) and return:

```json
{ "data": [ /* items */ ], "meta": { "page": 1, "pageSize": 20, "total": 137, "totalPages": 7 } }
```
