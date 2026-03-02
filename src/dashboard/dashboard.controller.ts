import { Controller, Get, Param, Req, UseGuards } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { Request } from 'express';
import { AuthGuard } from 'src/common/guards/auth/auth.guard';

@UseGuards(AuthGuard)
@Controller('organizations/:orgId/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  getDashboardStats(@Param('orgId') orgId: string, @Req() req: Request) {
    return this.dashboardService.getDashboardStats(orgId, req);
  }
}
