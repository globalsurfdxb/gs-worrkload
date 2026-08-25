import { SystemRole } from "@prisma/client";

export interface JwtPayload {
  sub: string;
  email: string;
  role: SystemRole;
  departmentId: string | null;
  teamIds: string[];
}
