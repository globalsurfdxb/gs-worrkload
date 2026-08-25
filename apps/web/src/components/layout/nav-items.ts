import { SystemRole } from "@gs-workhub/shared";
import {
  Bug,
  Building2,
  CalendarClock,
  CheckSquare,
  ClipboardCheck,
  FolderKanban,
  Gauge,
  LayoutDashboard,
  Paperclip,
  Rocket,
  Settings,
  Users,
  UsersRound,
  Bell,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: typeof LayoutDashboard;
  roles?: SystemRole[];
}

export const primaryNavItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Departments", href: "/departments", icon: Building2 },
  { label: "Employees", href: "/employees", icon: Users },
  { label: "Projects", href: "/projects", icon: FolderKanban },
  { label: "Tasks", href: "/tasks", icon: CheckSquare },
  {
    // Coarse role gate only — the page itself checks Development-team-lead
    // access (see `useDevTeamAccess` in @/lib/dev-shared).
    label: "Sprints",
    href: "/sprints",
    icon: Rocket,
    roles: [SystemRole.SUPER_ADMIN, SystemRole.DEPARTMENT_MANAGER, SystemRole.TEAM_LEAD],
  },
  {
    // Coarse role gate only — the page itself checks Development-team-lead
    // access (see `useDevTeamAccess` in @/lib/dev-shared).
    label: "Bugs",
    href: "/bugs",
    icon: Bug,
    roles: [SystemRole.SUPER_ADMIN, SystemRole.DEPARTMENT_MANAGER, SystemRole.TEAM_LEAD],
  },
  { label: "Workload", href: "/workload", icon: Gauge },
  // The Development team's dashboard is no longer a separate nav entry — the main
  // "Dashboard" item renders it for the Development team's Team Lead.
  { label: "Timesheets", href: "/timesheets", icon: CalendarClock },
  { label: "Approvals", href: "/approvals", icon: ClipboardCheck },
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "Files", href: "/files", icon: Paperclip },
];

export const adminNavItems: NavItem[] = [
  {
    label: "Admin Panel",
    href: "/admin/departments",
    icon: Settings,
    roles: [SystemRole.SUPER_ADMIN, SystemRole.DEPARTMENT_MANAGER],
  },
  {
    label: "Teams",
    href: "/admin/teams",
    icon: UsersRound,
    roles: [SystemRole.SUPER_ADMIN, SystemRole.DEPARTMENT_MANAGER, SystemRole.TEAM_LEAD],
  },
];
