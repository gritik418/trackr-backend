import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { SubscriptionGuard } from './subscription.guard';
import { SubscriptionsService } from '../subscriptions.service';
import { LimitHandler } from '../handlers/limit.handler';
import { AuditLogsService } from 'src/audit-logs/audit-logs.service';
import { Limit } from '../enums/limit.enum';
import { AuditAction, AuditEntityType } from 'generated/prisma/enums';

describe('SubscriptionGuard', () => {
  let guard: SubscriptionGuard;
  let reflector: Reflector;
  let subscriptionsService: SubscriptionsService;
  let limitHandler: LimitHandler;
  let auditLogsService: AuditLogsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SubscriptionGuard,
        {
          provide: Reflector,
          useValue: {
            getAllAndOverride: jest.fn(),
          },
        },
        {
          provide: SubscriptionsService,
          useValue: {
            getSubscriptionByContext: jest.fn(),
          },
        },
        {
          provide: LimitHandler,
          useValue: {
            checkLimit: jest.fn(),
          },
        },
        {
          provide: AuditLogsService,
          useValue: {
            createLog: jest.fn(),
          },
        },
      ],
    }).compile();

    guard = module.get<SubscriptionGuard>(SubscriptionGuard);
    reflector = module.get<Reflector>(Reflector);
    subscriptionsService =
      module.get<SubscriptionsService>(SubscriptionsService);
    limitHandler = module.get<LimitHandler>(LimitHandler);
    auditLogsService = module.get<AuditLogsService>(AuditLogsService);
  });

  it('should be defined', () => {
    expect(guard).toBeDefined();
  });

  it('should allow access if no limits are defined for the route', async () => {
    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(null);

    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue({ user: { id: 'user1' } }),
      }),
    } as unknown as ExecutionContext;

    const result = await guard.canActivate(context);
    expect(result).toBe(true);
  });

  it('should throw ForbiddenException and log audit if limit is reached', async () => {
    const limitKeys = [Limit.MAX_TASKS_PER_PROJECT];
    const orgId = 'org1';
    const userId = 'user1';
    const req = {
      user: { id: userId },
      params: { orgId },
      headers: { 'user-agent': 'test-agent' },
      ip: '127.0.0.1',
    };

    jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(limitKeys);
    jest
      .spyOn(subscriptionsService, 'getSubscriptionByContext')
      .mockResolvedValue({
        subscription: { limits: { maxTasksPerProject: 10 } },
      } as any);
    jest.spyOn(limitHandler, 'checkLimit').mockResolvedValue(false);

    const context = {
      getHandler: jest.fn(),
      getClass: jest.fn(),
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(req),
      }),
    } as unknown as ExecutionContext;

    await expect(guard.canActivate(context)).rejects.toThrow(
      ForbiddenException,
    );

    expect(auditLogsService.createLog).toHaveBeenCalledWith({
      action: AuditAction.SUBSCRIPTION_LIMIT_REACHED,
      entityType: AuditEntityType.SUBSCRIPTION,
      entityId: orgId,
      organizationId: orgId,
      workspaceId: undefined,
      userId,
      details: {
        limitKey: Limit.MAX_TASKS_PER_PROJECT,
        message: expect.stringContaining('limit for max tasks per project'),
      },
      ipAddress: '127.0.0.1',
      userAgent: 'test-agent',
    });
  });
});
