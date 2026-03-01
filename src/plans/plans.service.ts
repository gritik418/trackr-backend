import { BadRequestException, Injectable } from '@nestjs/common';
import { PlanType } from 'generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PlansService {
  constructor(private readonly prismaService: PrismaService) {}

  async getPlans() {
    const plans = await this.prismaService.plan.findMany();

    return {
      success: true,
      message: 'Plans retrieved successfully.',
      plans,
    };
  }

  async getEarlyAccessPlan() {
    const earlyAccessPlan = await this.prismaService.plan.findFirst({
      where: {
        type: PlanType.EARLY_ACCESS,
        isActive: true,
      },
    });

    if (!earlyAccessPlan)
      throw new BadRequestException('Early access plan not found.');

    return {
      success: true,
      message: 'Early access plan retrieved successfully.',
      plan: earlyAccessPlan,
    };
  }
}
