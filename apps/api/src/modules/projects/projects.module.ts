import { Module } from "@nestjs/common";
import { ProjectTemplatesController } from "./project-templates.controller";
import { ProjectTemplatesService } from "./project-templates.service";
import { ProjectsController } from "./projects.controller";
import { ProjectsService } from "./projects.service";

@Module({
  controllers: [ProjectsController, ProjectTemplatesController],
  providers: [ProjectsService, ProjectTemplatesService],
  exports: [ProjectsService, ProjectTemplatesService],
})
export class ProjectsModule {}
