import { Body, Controller, Get, Post } from "@nestjs/common";
import { SystemRole } from "@prisma/client";
import { Roles } from "../../common/decorators/roles.decorator";
import { CreateProjectTemplateDto } from "./dto/create-project-template.dto";
import { ProjectTemplatesService } from "./project-templates.service";

@Controller("project-templates")
export class ProjectTemplatesController {
  constructor(private readonly projectTemplatesService: ProjectTemplatesService) {}

  @Get()
  findAll() {
    return this.projectTemplatesService.findAll();
  }

  @Post()
  @Roles(SystemRole.SUPER_ADMIN, SystemRole.DEPARTMENT_MANAGER)
  create(@Body() dto: CreateProjectTemplateDto) {
    return this.projectTemplatesService.create(dto);
  }
}
