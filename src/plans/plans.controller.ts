import { Controller, Get } from '@nestjs/common';
import { PlansService } from './plans.service';

@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  async getPlans() {
    return this.plansService.getPlans();
  }
}
