import { SystemRole } from "@prisma/client";

export interface AuthenticatedRequestUser {
  id: string;
  email: string;
  role: SystemRole;
  departmentId: string | null;
  teamIds: string[];
}
