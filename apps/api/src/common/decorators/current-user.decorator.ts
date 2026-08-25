import { createParamDecorator, ExecutionContext } from "@nestjs/common";
import type { AuthenticatedRequestUser } from "../types/authenticated-request-user";

export const CurrentUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthenticatedRequestUser => {
    const request = ctx.switchToHttp().getRequest();
    return request.user;
  },
);
