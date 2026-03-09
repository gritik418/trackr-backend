import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import { LIMIT_KEY } from '../decorators/subscription.decorator';
import { Limit } from '../enums/limit.enum';
import { LIMIT_TO_PLAN_FIELD } from '../mappings/limit-plan.map';
import { SubscriptionsService } from '../subscriptions.service';
import { LimitHandler } from '../handlers/limit.handler';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly limitHandler: LimitHandler,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const userId = req.user?.id;
    const orgId =
      req.params.orgId || req.body.orgId || (req.query.orgId as string);

    if (!userId) {
      throw new ForbiddenException('Access denied');
    }

    const limitsKeys = this.reflector.getAllAndOverride<Limit[]>(LIMIT_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!limitsKeys || limitsKeys.length === 0) {
      return true;
    }

    if (!orgId) {
      throw new ForbiddenException(
        'Organization ID is required for limit check',
      );
    }

    const activeSub =
      await this.subscriptionsService.getActiveSubscription(orgId);

    if (!activeSub || !activeSub.subscription) {
      throw new ForbiddenException(
        'No active subscription found for this organization',
      );
    }

    const subscriptionLimits = activeSub.subscription.limits as Record<
      string,
      any
    >;

    for (const limitKey of limitsKeys) {
      const planField = LIMIT_TO_PLAN_FIELD[limitKey];
      const limitValue = subscriptionLimits[planField];

      const isAllowed = await this.limitHandler.checkLimit(limitKey, orgId, {
        limitValue,
        workspaceId: req.params.workspaceId,
        projectId: req.params.projectId,
      });

      if (!isAllowed) {
        throw new ForbiddenException(
          `You have reached the limit for ${limitKey.toLowerCase().replace(/_/g, ' ')} in your current plan.`,
        );
      }
    }

    return true;
  }
}
