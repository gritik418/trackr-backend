import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EMAIL_JOBS, EMAIL_QUEUE } from './email.constants';
import { VerificationEmailDTO } from './dto/verification-email.dto';
import { ForgotPasswordEmailDTO } from './dto/forgot-password-email.dto';

@Injectable()
export class EmailProducer {
  constructor(
    @InjectQueue(EMAIL_QUEUE)
    private readonly emailQueue: Queue,
  ) {}

  async sendVerificationEmail(data: VerificationEmailDTO) {
    await this.emailQueue.add(EMAIL_JOBS.SEND_VERIFICATION, data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: true,
      removeOnFail: 50,
    });
  }

  async sendForgotPasswordEmail(data: ForgotPasswordEmailDTO) {
    await this.emailQueue.add(EMAIL_JOBS.FORGOT_PASSWORD, data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: true,
      removeOnFail: 50,
    });
  }
}
