import { ProjectMethodology } from "@gs-workhub/shared";
import type { BadgeProps } from "@/components/ui/badge";

type BadgeVariant = NonNullable<BadgeProps["variant"]>;

/** A team's default delivery methodology (Development = Agile, most others = Kanban, IT Projects = Waterfall). */
export const PROJECT_METHODOLOGY_LABELS: Record<ProjectMethodology, string> = {
  [ProjectMethodology.AGILE]: "Agile",
  [ProjectMethodology.KANBAN]: "Kanban",
  [ProjectMethodology.WATERFALL]: "Waterfall",
};

export function projectMethodologyBadgeVariant(methodology: ProjectMethodology): BadgeVariant {
  switch (methodology) {
    case ProjectMethodology.AGILE:
      return "default";
    case ProjectMethodology.KANBAN:
      return "secondary";
    case ProjectMethodology.WATERFALL:
      return "outline";
    default:
      return "outline";
  }
}
