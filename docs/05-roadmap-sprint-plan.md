# GS WorkHub — Development Roadmap & Sprint Plan

## 1. Roadmap (as specified, annotated with delivery status)

| Phase | Scope | Status |
|---|---|---|
| **Phase 1 — MVP** | Auth, Employee Management, Department Management, Team Management, Project Management, Task Management, Workload Dashboard | **Built this engagement** (code) |
| **Phase 2** | Timesheets, Approvals, Notifications, Reports, File Management | **Built this engagement** (code) |
| **Phase 3** | Scrum Boards, QA Module, SEO Module, Content Module, Design Module, Marketing Module, IT Workspace | Documented here; not yet built — see §3 |
| **Phase 4** | AI Features, Mobile App, Client Portal, Advanced Analytics | Documented here; not yet built — see §3 |

## 2. Sprint Plan for What Was Built (Phase 1 + 2)

Assuming 2-week sprints and a small full-stack team (2 backend, 2 frontend, 1 QA — adjust to actual staffing):

| Sprint | Backend | Frontend | Exit criteria |
|---|---|---|---|
| **Sprint 0** (setup) | Monorepo, Prisma schema, seed data, CI skeleton, docker-compose for local Postgres/Redis | Design tokens (brand colors, dark/light), ShadCN setup, layout shell | `pnpm dev` boots both apps locally against local Postgres |
| **Sprint 1** | Auth (JWT+refresh+RBAC guards), Employees, Departments | Login flow, protected route shell, employee directory, admin department CRUD | Can log in as seeded Super Admin and see the GlobalSurf department list |
| **Sprint 2** | Teams, Projects (+milestones+templates) | Team management UI, project list + create + detail | Can create a team under a department and a project under that team |
| **Sprint 3** | Tasks (+subtasks+dependencies+comments+activity log), Workload | Task list/kanban/calendar views, task detail panel, workload dashboard widgets | Can create/assign tasks, drag between kanban columns, see overload/underutilized widgets update |
| **Sprint 4** | Timesheets, Approvals | Timesheet entry form + weekly view, approvals inbox | Can submit a timesheet, have a manager approve it end-to-end |
| **Sprint 5** | Notifications (+Socket.io gateway), Files (+Azure Blob) | Notification center + realtime toast, file upload/download on tasks & projects | Realtime notification appears without a page refresh; file round-trips through Azure Blob |
| **Sprint 6** | Reports/KPI snapshots; hardening, security review, load-test workload/report endpoints | Company/department/team dashboards, polish pass, responsive/mobile QA, dark mode QA | Company dashboard renders real aggregate numbers; accessibility + responsive pass complete |

*(This mirrors the delivery sequence actually followed in this engagement; sprint boundaries can be compressed if the team is larger than assumed above.)*

## 3. Phase 3 & 4 — Planning Notes for the Next Engagement

These are scoped but **not built** — building seven more subsystems and four Phase-4 initiatives without the Phase 1+2 foundation being reviewed in production would be shipping unvalidated work on top of unvalidated work. Recommended order for a follow-up engagement:

**Phase 3** (each is a workspace built on top of the existing Project/Task backbone, not a parallel data model):
1. Development Team — Scrum Board (sprint-scoped Task views), Sprint Planning, Product/Sprint Backlog, Bug Tracking (new `Bug` entity or a `Task` sub-type — decide during that phase's design), Release Tracking, Code Review Tracking.
2. QA Team — Test Case Management, Test Execution, Bug Verification, Regression Testing, QA Reports (Bug workflow: New → Assigned → In Progress → Fixed → QA Review → Closed).
3. SEO / Content / Design / Marketing / In-House Marketing — each is largely a themed view over Tasks + Approvals + a small amount of module-specific metadata (keyword tracking for SEO, content calendar for Content, revision tracking for Design, campaign performance for Marketing) — cheapest to build once Tasks/Approvals are proven in production.
4. IT Department Workspace — IT Projects (Agile/Waterfall project templates already supported by `ProjectTemplate`), IT Solutions (Solution Requests / Change Requests as an `ApprovalType` extension or new entity).

**Phase 4:**
1. AI Features — task assignment, sprint planning, workload prediction, risk analysis, summaries. Natural integration point: a new `AiInsightsModule` that reads the same Prisma data and calls an LLM; no schema changes needed to start.
2. Mobile App — React Native or a PWA wrapper around the existing REST API; the API is already stateless JWT, so no backend rework is required, only a mobile-optimized frontend.
3. Client Portal — activate the `CLIENT` role's UI (schema and RBAC matrix already account for it in `03-rbac-matrix.md`).
4. Advanced Analytics — likely warrants a read-replica or a dedicated analytics store (see `07-scalability-plan.md` §4) once report query volume grows.

## 4. Immediate Next Steps After This Engagement

1. Run `pnpm install`, apply the Prisma migration against a real Postgres instance, and seed it.
2. Rotate the placeholder JWT secrets and Super Admin password (`ChangeMe123!`) before any shared/staging deployment.
3. Provision real Azure Blob Storage credentials to exercise the Files module end-to-end (it fails closed with a clear error until then, by design).
4. Security review pass on the RBAC matrix against real usage before onboarding non-pilot departments.
