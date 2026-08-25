import { SetMetadata } from "@nestjs/common";

export const DEPARTMENT_SCOPE_KEY = "departmentScopeParam";

/**
 * Marks a route as department-scoped. `paramName` names the request param/query/body
 * field that carries the departmentId to check against the caller's own department.
 * SUPER_ADMIN always bypasses this check (see DepartmentScopeGuard).
 */
export const DepartmentScoped = (paramName = "departmentId") =>
  SetMetadata(DEPARTMENT_SCOPE_KEY, paramName);
