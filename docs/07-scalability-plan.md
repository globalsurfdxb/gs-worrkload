# GS WorkHub — Future Scalability Plan

Baseline target stated in the spec: **500+ employees, multiple departments**, with room to add departments/teams without a deploy. This document lays out what changes, and at what trigger point, as the platform grows past that baseline — not premature infrastructure for load the platform doesn't have yet.

## 1. What's already scale-appropriate at 500 employees

- **Modular monolith** (§4 of `01-architecture.md`) — one deployable, stateless API process, horizontally scaled behind a load balancer. This comfortably handles well over 500 concurrent users; splitting into microservices before there's a proven hot spot would add operational cost without a corresponding benefit.
- **Application-layer department isolation** (not one schema/DB per department) — keeps migrations, backups, and connection pooling simple at this scale. See §3 for the upgrade path if a compliance requirement later demands database-layer isolation.
- **JWT + Redis**, not server-session affinity — any API instance can serve any request, so autoscaling is just adding instances.

## 2. Growth Triggers and Responses

| Signal | Response |
|---|---|
| Postgres CPU/connection saturation under normal load | Add a read replica; route report/workload aggregation reads (already isolated to their own modules, see §4 of `01-architecture.md`) to the replica. The module boundary rule (no cross-module imports) makes this a config change in `ReportsModule`/`WorkloadModule`, not a rewrite. |
| Report/KPI queries getting slow as task/timesheet volume grows | `KpiSnapshot` already exists as a precomputed rollup table — increase snapshot frequency (e.g. hourly via a scheduled job) instead of computing dashboards live from raw `Task`/`TimesheetEntry` rows. |
| Socket.io notification fan-out across multiple API instances | Add the Redis adapter for `@nestjs/platform-socket.io` (Redis is already in the stack) so a notification emitted from one instance reaches sockets connected to any other instance. |
| A department needs stronger data isolation than app-layer filtering (compliance/contractual requirement) | Add Postgres **Row-Level Security** policies keyed on `departmentId`, set via `SET app.current_department_id` per request — additive to the existing guard/service filtering, not a replacement; no schema migration needed since every relevant table already carries a `departmentId` or reaches one via FK. |
| Sustained high write volume on Tasks/Comments/Activity Log | Partition `ActivityLogEntry` by month (it's pure append, never updated) — cheapest table to partition first since nothing joins across partitions in a single query pattern. |
| File storage volume/egress grows significantly | Add a Blob Storage lifecycle policy (move attachments untouched for 90+ days to Cool/Archive tier) — no application change needed, `Attachment.blobPath` is storage-tier-agnostic. |
| Global/multi-region GlobalSurf offices with latency-sensitive usage | Azure Front Door already provides global routing (see `06-deployment-azure-architecture.md`); add a **read replica in the nearest region** before considering a full multi-region write topology, which would require solving conflict resolution the current single-writer design avoids entirely. |
| Phase 4 Advanced Analytics / AI Features | Stand up a separate analytics store (e.g. an Azure Synapse or a Postgres read-replica feeding a star schema) fed by CDC from the primary Postgres, rather than running analytical queries against the OLTP database — keeps report-dashboard latency unaffected by ad-hoc analytics workloads. |

## 3. Department-Isolation Upgrade Path (detail)

Today: every department-owned row carries or reaches a `departmentId`; `DepartmentScopeGuard` blocks cross-department writes; every service filters reads by the caller's department. This is enforced in **application code**, which is simple to operate but means a bug in a new module's service method is the only thing standing between a user and another department's data.

If/when that risk profile stops being acceptable (e.g. a large new department onboarding with contractual data-segregation requirements), the upgrade is additive:
1. Enable Postgres RLS on department-owned tables.
2. Add a policy: `USING (department_id = current_setting('app.current_department_id')::uuid OR current_setting('app.current_role') = 'SUPER_ADMIN')`.
3. Have `PrismaService` (or a request-scoped wrapper around it) run `SET LOCAL app.current_department_id = ...` at the start of each request's transaction.

No schema change, no data migration — it's a defense-in-depth layer added on top of what already exists.

## 4. Cost/Complexity Discipline

The explicit anti-pattern this plan avoids: reaching for Kubernetes, microservices, multi-region active-active, or a dedicated analytics warehouse **before** a real signal (a specific metric crossing a specific threshold) justifies the added operational surface. Every row in §2 above is written as "when X happens, do Y" rather than "do Y now, just in case" — GlobalSurf's 500-employee, department-based usage pattern is squarely within what a well-run modular monolith on managed Azure PaaS handles without drama.
