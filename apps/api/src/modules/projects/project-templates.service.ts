import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { CreateProjectTemplateDto } from "./dto/create-project-template.dto";

@Injectable()
export class ProjectTemplatesService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
    return this.prisma.projectTemplate.findMany({ orderBy: { createdAt: "desc" } });
  }

  create(dto: CreateProjectTemplateDto) {
    return this.prisma.projectTemplate.create({
      data: {
        name: dto.name,
        description: dto.description,
        defaultMilestones: dto.defaultMilestones as unknown as Prisma.InputJsonValue,
      },
    });
  }
}
