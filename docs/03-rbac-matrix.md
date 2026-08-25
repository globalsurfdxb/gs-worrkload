# GS WorkHub — RBAC Permission Matrix

## 1. Roles

| Role | Scope |
|---|---|
| `SUPER_ADMIN` | Entire organization — every department, project, report, user, and system setting. |
| `DEPARTMENT_MANAGER` | Their own department: its teams, projects, employees, reports, resource allocation. |
| `TEAM_LEAD` | Their own team(s): create/assign/review tasks, monitor team workload, approve team-level requests. |
| `EMPLOYEE` | Their own assigned work: view/update assigned tasks, submit timesheets, upload files, request approvals. |
| `CLIENT` *(Phase 4 — schema/role exists today, UI is future work)* | Read-only project status + deliverable review/approval on projects they're invited to. |

## 2. Enforcement Mechanism

Two layers, both real code today (`apps/api/src/common/guards/`):

1. **`RolesGuard`** — declarative, per-route: `@Roles(SystemRole.SUPER_ADMIN, SystemRole.DEPARTMENT_MANAGER)` on a controller method. No metadata = any authenticated role may call it.
2. **`DepartmentScopeGuard`** — declarative, per-route, for writes that carry an explicit `departmentId`: `@DepartmentScoped()` rejects the call if the target department isn't the caller's own (SUPER_ADMIN always passes).
3. **Service-layer filtering** — for list/read endpoints, no guard can know which rows belong to which department once you're inside a paginated query, so every module's service filters `WHERE departmentId = currentUser.departmentId` (or `teamId IN currentUser.teamIds`, or `employeeId = currentUser.id`) for non-SUPER_ADMIN callers. This is the layer that actually enforces "an Employee only sees their own timesheets" or "a Department Manager only sees their own department's projects."

## 3. Permission Matrix

Legend: **F** full access · **D** department/team/own-scope only · **R** read-only · **–** no access

| Capability | Super Admin | Dept. Manager | Team Lead | Employee | Client |
|---|---|---|---|---|---|
| **Organization & Departments** |
| Create / edit / archive departments | F | – | – | – | – |
| View department dashboard | F | D (own) | R (own) | R (own) | – |
| Department resource allocation view | F | D (own) | – | – | – |
| **Teams** |
| Create / edit / archive teams | F | D (own dept.) | – | – | – |
| Assign team lead / members | F | D (own dept.) | D (own team, members only) | – | – |
| View team dashboard / capacity | F | D (own dept.) | D (own team) | R (own team) | – |
| **Employees** |
| Create / deactivate employee accounts | F | D (own dept.) | – | – | – |
| Edit employee profile / designation / skills | F | D (own dept.) | – | Own profile only | – |
| View employee directory | F | D (own dept.) | D (own team) | R (own dept.) | – |
| **Projects** |
| Create / edit / cancel projects | F | D (own dept.) | D (own team, if owner) | – | – |
| Approve project (Approval System) | F | D (own dept.) | – | – | R (assigned projects) |
| View project | F | D (own dept.) | D (own team) | D (assigned) | R (assigned) |
| **Tasks** |
| Create / assign / edit tasks | F | D (own dept.) | D (own team) | Own assigned tasks (status/comments) | – |
| Delete tasks | F | D (own dept.) | D (own team) | – | – |
| Review / approve task completion | F | D (own dept.) | D (own team) | – | – |
| **Workload** |
| View department/company workload dashboards | F | D (own dept.) | D (own team) | R (own utilization only) | – |
| **Timesheets** |
| Submit timesheet | F | F (own) | F (own) | F (own) | – |
| Approve/reject timesheet | F | D (own dept.) | D (own team) | – | – |
| View others' timesheets | F | D (own dept.) | D (own team) | – | – |
| **Approvals (Leave/Task/Content/Design/Project)** |
| Submit approval request | F | F (own) | F (own) | F (own) | R (project deliverables) |
| Decide (approve/reject) | F | D (own dept.) | D (own team) | – | R (own project deliverables — approve only, Phase 4) |
| **Files** |
| Upload / delete files | F | D (own dept.) | D (own team) | D (own tasks/projects) | – |
| Download files | F | D (own dept.) | D (own team) | D (assigned) | R (shared deliverables) |
| **Notifications** |
| Receive personal notifications | F | F | F | F | F (Phase 4) |
| Send team announcements | F | D (own dept.) | D (own team) | – | – |
| **Reports & KPIs** |
| Company-wide dashboard | F | – | – | – | – |
| Department dashboard | F | D (own dept.) | – | – | – |
| Team dashboard | F | D (own dept.) | D (own team) | R (own team) | – |
| Trigger KPI snapshot | F | D (own dept.) | – | – | – |
| **System Settings / Admin Panel** |
| Manage departments/teams/roles (dynamic org config) | F | – | – | – | – |
| View audit logs | F | R (own dept. actions) | – | – | – |

## 4. Notes

- "D (own X)" always means the guard/service combination described in §2 — there is no role that gets department-scoped access without that scoping being enforced in code, not just documented here.
- `TEAM_LEAD` capacity to "own a project" is intentional: Team Leads run day-to-day delivery and should be able to spin up a project for their team without waiting on a Department Manager, but cannot create the team itself or reassign the team lead role.
- The **Client** role's rows describe the Phase 4 client portal target state; until that ships, no Client-role UI exists and any such user is effectively read-only via direct API calls only (not exposed in the current frontend).
