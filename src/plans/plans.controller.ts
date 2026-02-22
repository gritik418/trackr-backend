import { Controller, Get } from '@nestjs/common';
import { PlansService, Plan } from './plans.service';

@Controller('plans')
export class PlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get()
  async getPlans(): Promise<Plan[]> {
    return this.plansService.getPlans();
  }
}
