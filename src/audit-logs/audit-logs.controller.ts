import {
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Query,
  Req,
  Res,
  UseGuards,
  UsePipes,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { OrgRole } from 'generated/prisma/enums';
import { AuthGuard } from 'src/common/guards/auth/auth.guard';
import { ZodValidationPipe } from 'src/common/pipes/zod-validation/zod-validation.pipe';
import { OrgRoles } from 'src/organizations/decorators/org-roles.decorator';
import { OrgRoleGuard } from 'src/organizations/guards/org-role/org-role.guard';
import { AuditLogsService } from './audit-logs.service';
import {
  GetAuditLogsDto,
  getAuditLogsSchema,
} from './dto/get-audit-logs.schema';

@UseGuards(AuthGuard)
@Controller('audit-logs')
export class AuditLogsController {
  constructor(private readonly auditLogsService: AuditLogsService) {}

  @Get('/organization/:orgId')
  @HttpCode(HttpStatus.OK)
  @OrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  @UseGuards(OrgRoleGuard)
  @UsePipes(new ZodValidationPipe(getAuditLogsSchema))
  async getOrgLogs(@Req() req: Request, @Query() query: GetAuditLogsDto) {
    const orgId = req.params.orgId as string;
    return this.auditLogsService.getLogs({
      orgId,
      ...query,
    });
  }

  @Get('/workspace/:orgId/:workspaceId')
  @HttpCode(HttpStatus.OK)
  @OrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  @UseGuards(OrgRoleGuard)
  @UsePipes(new ZodValidationPipe(getAuditLogsSchema))
  async getWorkspaceLogs(@Req() req: Request, @Query() query: GetAuditLogsDto) {
    const orgId = req.params.orgId as string;
    const workspaceId = req.params.workspaceId as string;
    return this.auditLogsService.getLogs({
      orgId,
      workspaceId,
      ...query,
    });
  }

  @Get('/export/:orgId')
  @HttpCode(HttpStatus.OK)
  @OrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  @UseGuards(OrgRoleGuard)
  @UsePipes(new ZodValidationPipe(getAuditLogsSchema))
  async exportWorkspaceLogs(
    @Param('orgId') orgId: string,
    @Res() res: Response,
    @Req() req: Request,
    @Query() query: GetAuditLogsDto,
  ) {
    return this.auditLogsService.exportLogs(orgId, res, req, query);
  }
}
