import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import { EMAIL_JOBS, EMAIL_QUEUE } from '../email.constants';
import { WelcomeEmailDTO } from '../dto/welcome-email.dto';
import { IEmailProducer } from '../email.interface';
import { Queue } from 'bullmq';
import { EarlyAccessActivationEmailDTO } from '../dto/early-access-activation-email.dto';
import { ForgotPasswordEmailDTO } from '../dto/forgot-password-email.dto';
import { OrganizationInviteEmailDTO } from '../dto/organization-invite-email.dto';
import { VerificationEmailDTO } from '../dto/verification-email.dto';
import { WorkspaceInviteEmailDTO } from '../dto/workspace-invite-email.dto';
import { EmailProducer } from '../email.producer';

@Injectable()
export class QueueEmailProducer
  extends EmailProducer
  implements IEmailProducer
{
  constructor(
    @InjectQueue(EMAIL_QUEUE)
    private readonly emailQueue: Queue,
  ) {
    super();
  }

  async sendWelcomeEmail(data: WelcomeEmailDTO) {
    await this.emailQueue.add(EMAIL_JOBS.WELCOME, data, this.jobOptions);
  }

  async sendVerificationEmail(data: VerificationEmailDTO) {
    await this.emailQueue.add(
      EMAIL_JOBS.SEND_VERIFICATION,
      data,
      this.jobOptions,
    );
  }

  async sendForgotPasswordEmail(data: ForgotPasswordEmailDTO) {
    await this.emailQueue.add(
      EMAIL_JOBS.FORGOT_PASSWORD,
      data,
      this.jobOptions,
    );
  }

  async sendOrganizationInviteEmail(data: OrganizationInviteEmailDTO) {
    await this.emailQueue.add(
      EMAIL_JOBS.ORGANIZATION_INVITE,
      data,
      this.jobOptions,
    );
  }

  async sendWorkspaceInviteEmail(data: WorkspaceInviteEmailDTO) {
    await this.emailQueue.add(
      EMAIL_JOBS.WORKSPACE_INVITE,
      data,
      this.jobOptions,
    );
  }

  async sendEarlyAccessActivationEmail(data: EarlyAccessActivationEmailDTO) {
    await this.emailQueue.add(
      EMAIL_JOBS.SEND_EARLY_ACCESS_ACTIVATION,
      data,
      this.jobOptions,
    );
  }
}
