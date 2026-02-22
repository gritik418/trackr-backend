import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class PlansService {
  constructor(private readonly prismaService: PrismaService) {}

  async getPlans() {
    const plans = await this.prismaService.plan.findMany();

    return {
      message: 'Plans retrieved successfully.',
      plans,
    };
  }
}
