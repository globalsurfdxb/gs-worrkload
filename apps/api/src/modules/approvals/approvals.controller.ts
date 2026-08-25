import { Body, Controller, Get, Param, Post, Query } from "@nestjs/common";
import { SystemRole } from "@prisma/client";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import { Roles } from "../../common/decorators/roles.decorator";
import type { AuthenticatedRequestUser } from "../../common/types/authenticated-request-user";
import { ApprovalsService } from "./approvals.service";
import { ApproveApprovalDto } from "./dto/approve-approval.dto";
import { CreateApprovalDto } from "./dto/create-approval.dto";
import { ListApprovalsQueryDto } from "./dto/list-approvals-query.dto";
import { RejectApprovalDto } from "./dto/reject-approval.dto";

@Controller("approvals")
export class ApprovalsController {
  constructor(private readonly approvalsService: ApprovalsService) {}

  @Get()
  findAll(
    @Query() query: ListApprovalsQueryDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.approvalsService.findAll(query, user);
  }

  @Get(":id")
  findOne(@Param("id") id: string, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.approvalsService.findOne(id, user);
  }

  @Post()
  create(@Body() dto: CreateApprovalDto, @CurrentUser() user: AuthenticatedRequestUser) {
    return this.approvalsService.create(dto, user);
  }

  @Post(":id/approve")
  @Roles(SystemRole.SUPER_ADMIN, SystemRole.DEPARTMENT_MANAGER, SystemRole.TEAM_LEAD)
  approve(
    @Param("id") id: string,
    @Body() dto: ApproveApprovalDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.approvalsService.approve(id, dto.comment, user);
  }

  @Post(":id/reject")
  @Roles(SystemRole.SUPER_ADMIN, SystemRole.DEPARTMENT_MANAGER, SystemRole.TEAM_LEAD)
  reject(
    @Param("id") id: string,
    @Body() dto: RejectApprovalDto,
    @CurrentUser() user: AuthenticatedRequestUser,
  ) {
    return this.approvalsService.reject(id, dto.comment, user);
  }
}
