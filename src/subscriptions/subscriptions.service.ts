import { BadRequestException, Injectable } from '@nestjs/common';
import { Request } from 'express';
import {
  PlanInterval,
  PlanType,
  SubscriptionStatus,
} from 'generated/prisma/enums';
import { PrismaService } from 'src/prisma/prisma.service';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prismaService: PrismaService) {}

  async claimEarlyAccess(planId: string, req: Request) {
    const userId = req.user?.id;

    if (!userId)
      throw new BadRequestException(
        'You must be logged in to claim early access.',
      );

    const user = await this.prismaService.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!user)
      throw new BadRequestException(
        'You must be logged in to claim early access.',
      );

    const earlyAccessPlan = await this.prismaService.plan.findUnique({
      where: {
        id: planId,
      },
    });

    if (!earlyAccessPlan)
      throw new BadRequestException('Early access plan not found.');

    if (
      !earlyAccessPlan.isActive ||
      earlyAccessPlan.type !== PlanType.EARLY_ACCESS
    )
      throw new BadRequestException('Early access plan is not active.');

    const isAlreadyClaimed = await this.prismaService.subscription.findFirst({
      where: {
        userId,
        planId: earlyAccessPlan.id,
      },
    });

    if (isAlreadyClaimed)
      throw new BadRequestException('You have already claimed early access.');

    const activeSubscription = await this.prismaService.subscription.findFirst({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
      },
    });

    if (activeSubscription) {
      await this.prismaService.subscription.update({
        where: { id: activeSubscription.id },
        data: {
          status: SubscriptionStatus.CANCELED,
          endDate: new Date(),
        },
      });
    }

    const claimed = await this.prismaService.subscription.create({
      data: {
        userId: userId,
        planId: earlyAccessPlan.id,
        planType: earlyAccessPlan.type,
        status: SubscriptionStatus.ACTIVE,
        startDate: new Date(),
        endDate:
          earlyAccessPlan.interval === PlanInterval.MONTH
            ? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
            : earlyAccessPlan.interval === PlanInterval.YEAR
              ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
              : null,
        trialEndDate: null,
        autoRenew: false,
        price: earlyAccessPlan.price,
        currency: earlyAccessPlan.currency,
        interval: earlyAccessPlan.interval,
        features: earlyAccessPlan.features || {},
        limits: earlyAccessPlan.limits || {},
      },
    });

    return {
      success: true,
      message: 'Early access claimed successfully.',
      subscription: claimed,
    };
  }
}
