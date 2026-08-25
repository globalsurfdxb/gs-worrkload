import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { SystemRole } from "@prisma/client";
import { DEPARTMENT_SCOPE_KEY } from "../decorators/department-scope.decorator";
import type { AuthenticatedRequestUser } from "../types/authenticated-request-user";

/**
 * Enforces department-level data isolation for non-SUPER_ADMIN roles: a
 * DEPARTMENT_MANAGER / TEAM_LEAD / EMPLOYEE may only act on resources that
 * belong to their own department. The department id is read from params,
 * then query, then body, using the field name set by @DepartmentScoped().
 */
@Injectable()
export class DepartmentScopeGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const paramName = this.reflector.getAllAndOverride<string | undefined>(DEPARTMENT_SCOPE_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!paramName) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user: AuthenticatedRequestUser | undefined = request.user;

    if (!user) {
      return false;
    }

    if (user.role === SystemRole.SUPER_ADMIN) {
      return true;
    }

    const targetDepartmentId =
      request.params?.[paramName] ?? request.query?.[paramName] ?? request.body?.[paramName];

    if (!targetDepartmentId) {
      // No department id present on this request (e.g. list endpoints) — the
      // service layer is responsible for filtering results by user.departmentId.
      return true;
    }

    if (targetDepartmentId !== user.departmentId) {
      throw new ForbiddenException("You do not have access to this department's data.");
    }

    return true;
  }
}
