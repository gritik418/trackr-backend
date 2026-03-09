import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { Request } from 'express';
import { AuthGuard } from 'src/common/guards/auth/auth.guard';
import { OrgRoleGuard } from 'src/organizations/guards/org-role/org-role.guard';
import { OrgRole } from 'generated/prisma/enums';
import { OrgRoles } from 'src/organizations/decorators/org-roles.decorator';

@UseGuards(AuthGuard)
@Controller('organizations/:orgId/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  @UseGuards(OrgRoleGuard)
  @OrgRoles(OrgRole.OWNER, OrgRole.ADMIN)
  getDashboardStats(@Param('orgId') orgId: string, @Req() req: Request) {
    return this.dashboardService.getDashboardStats(orgId, req);
  }
}
