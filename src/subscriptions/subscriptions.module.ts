import { Global, Module } from '@nestjs/common';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { EmailModule } from 'src/queues/email/email.module';
import { LimitHandler } from './handlers/limit.handler';
import { SubscriptionGuard } from './guards/subscription.guard';

@Global()
@Module({
  imports: [EmailModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, LimitHandler, SubscriptionGuard],
  exports: [SubscriptionsService, LimitHandler, SubscriptionGuard],
})
export class SubscriptionsModule {}
