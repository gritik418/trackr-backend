import {
  Controller,
  Get,
  Query,
  Req,
  UseGuards,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuditLogsService } from './audit-logs.service';
import { AuthGuard } from 'src/common/guards/auth/auth.guard';
import { Request } from 'express';
import { OrgRoleGuard } from 'src/organizations/guards/org-role/org-role.guard';
import { OrgRoles } from 'src/organizations/decorators/org-roles.decorator';
import { OrgRole, AuditAction, AuditEntityType } from 'generated/prisma/enums';

@UseGuards(AuthGuard)
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get('/organization/:orgId')
  @HttpCode(HttpStatus.OK)
  @OrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  @UseGuards(OrgRoleGuard)
  async getOrgLogs(
    @Req() req: Request,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('action') action?: AuditAction,
    @Query('entityType') entityType?: AuditEntityType,
    @Query('entityId') entityId?: string,
    @Query('userId') userId?: string,
  ) {
    const orgId = req.params.orgId as string;
    return this.auditLogsService.getLogs({
      orgId,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
      action,
      entityType,
      entityId,
      userId,
    });
  }

  @Get('/workspace/:orgId/:workspaceId')
  @HttpCode(HttpStatus.OK)
  @OrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  @UseGuards(OrgRoleGuard)
  async getWorkspaceLogs(
    @Req() req: Request,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Query('action') action?: AuditAction,
    @Query('entityType') entityType?: AuditEntityType,
    @Query('entityId') entityId?: string,
    @Query('userId') userId?: string,
  ) {
    const orgId = req.params.orgId as string;
    const workspaceId = req.params.workspaceId as string;
    return this.auditLogsService.getLogs({
      orgId,
      workspaceId,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0,
      action,
      entityType,
      entityId,
      userId,
    });
  }
}
