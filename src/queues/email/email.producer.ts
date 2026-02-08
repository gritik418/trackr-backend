import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { EMAIL_JOBS, EMAIL_QUEUE } from './email.constants';
import { VerificationEmailDTO } from './dto/verification-email.dto';
import { ForgotPasswordEmailDTO } from './dto/forgot-password-email.dto';
import { OrganizationInviteEmailDTO } from './dto/organization-invite-email.dto';
import { WorkspaceInviteEmailDTO } from './dto/workspace-invite-email.dto';
import { WelcomeEmailDTO } from './dto/welcome-email.dto';

@Injectable()
export class EmailProducer {
  constructor(
    @InjectQueue(EMAIL_QUEUE)
    private readonly emailQueue: Queue,
  ) {}

  async sendWelcomeEmail(data: WelcomeEmailDTO) {
    await this.emailQueue.add(EMAIL_JOBS.WELCOME, data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: true,
      removeOnFail: 50,
    });
  }

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

  async sendOrganizationInviteEmail(data: OrganizationInviteEmailDTO) {
    await this.emailQueue.add(EMAIL_JOBS.ORGANIZATION_INVITE, data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: true,
      removeOnFail: 50,
    });
  }

  async sendWorkspaceInviteEmail(data: WorkspaceInviteEmailDTO) {
    await this.emailQueue.add(EMAIL_JOBS.WORKSPACE_INVITE, data, {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: true,
      removeOnFail: 50,
    });
  }
}
