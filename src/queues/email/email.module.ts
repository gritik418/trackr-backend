import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { EMAIL_QUEUE } from './email.constants';
import { DirectEmailService } from './producers/direct.producer';
import { QueueEmailProducer } from './producers/queue.producer';
import { EmailProducer } from './email.producer';

const useQueue = process.env.USE_QUEUE === 'true';

@Module({
  imports: [
    ...(useQueue
      ? [
          BullModule.registerQueue({
            name: EMAIL_QUEUE,
          }),
        ]
      : []),
  ],
  providers: [
    {
      provide: EmailProducer,
      useClass: useQueue ? QueueEmailProducer : DirectEmailService,
    },
  ],
  exports: [EmailProducer],
})
export class EmailModule {}
