import { Global, Module } from '@nestjs/common';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';
import { EmailModule } from 'src/queues/email/email.module';
import { LimitHandler } from './handlers/limit.handler';

@Global()
@Module({
  imports: [EmailModule],
  controllers: [SubscriptionsController],
  providers: [SubscriptionsService, LimitHandler],
  exports: [SubscriptionsService, LimitHandler],
})
export class SubscriptionsModule {}
