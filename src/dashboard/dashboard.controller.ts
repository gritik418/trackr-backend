import { Controller, Get, Param } from '@nestjs/common';
import { DashboardService } from './dashboard.service';

@Controller('organizations/:orgId/dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('overview')
  getDashboardStats(@Param('orgId') orgId: string) {
    return this.dashboardService.getDashboardStats(orgId);
  }
}
