import { Body, Controller, Delete, Get, Param, Post, Query } from "@nestjs/common";
import { SystemRole } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { AuthenticatedRequestUser } from "../../common/types/authenticated-request-user";
import { CreateUploadUrlDto } from "./dto/create-upload-url.dto";
import { ListFilesQueryDto } from "./dto/list-files-query.dto";
import { FilesService } from "./files.service";

@Controller("files")
export class FilesController {
  constructor(private readonly filesService: FilesService) {}

  @Post("upload-url")
  createUploadUrl(
    @Body() dto: CreateUploadUrlDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.filesService.createUploadUrl(dto, user);
  }

  @Get(":id/download-url")
  getDownloadUrl(@Param("id") id: string) {
    return this.filesService.getDownloadUrl(id);
  }

  @Get(":id/versions")
  findVersions(@Param("id") id: string) {
    return this.filesService.findVersions(id);
  }

  @Get()
  findAll(@Query() query: ListFilesQueryDto) {
    return this.filesService.findAll(query);
  }

  @Delete(":id")
  @Roles(SystemRole.SUPER_ADMIN, SystemRole.DEPARTMENT_MANAGER, SystemRole.TEAM_LEAD)
  remove(@Param("id") id: string) {
    return this.filesService.remove(id);
  }
}
