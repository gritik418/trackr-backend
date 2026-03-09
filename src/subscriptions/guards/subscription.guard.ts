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
import { AuditLogsService } from 'src/audit-logs/audit-logs.service';

@Injectable()
export class SubscriptionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly limitHandler: LimitHandler,
    private readonly auditLogsService: AuditLogsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const ctx = context.switchToHttp();
    const req = ctx.getRequest<Request>();
    const userId = req.user?.id;
    const orgId =
      req.params?.orgId || req.body?.orgId || (req.query?.orgId as string);

    const workspaceId =
      req.params?.workspaceId ||
      req.body?.workspaceId ||
      (req.query?.workspaceId as string);

    const projectId =
      req.params?.projectId ||
      req.body?.projectId ||
      (req.query?.projectId as string);

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

    if (!orgId && !workspaceId && !projectId) {
      throw new ForbiddenException(
        'Organization ID or Workspace ID or Project ID is required for limit check',
      );
    }

    const activeSub = await this.subscriptionsService.getSubscriptionByContext(
      orgId,
      {
        workspaceId,
        projectId,
      },
    );

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
        workspaceId,
        projectId,
      });

      if (!isAllowed) {
        let message: string = `You have reached the limit for ${limitKey.toLowerCase().replace(/_/g, ' ')} in your current plan.`;
        if (limitKey === Limit.IS_LOG_EXPORT_AVAILABLE) {
          message = `The current plan doesn't have export audit log feature.`;
        }

        throw new ForbiddenException(message);
      }
    }

    return true;
  }
}
