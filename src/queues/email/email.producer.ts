import { EarlyAccessActivationEmailDTO } from './dto/early-access-activation-email.dto';
import { ForgotPasswordEmailDTO } from './dto/forgot-password-email.dto';
import { OrganizationInviteEmailDTO } from './dto/organization-invite-email.dto';
import { VerificationEmailDTO } from './dto/verification-email.dto';
import { WelcomeEmailDTO } from './dto/welcome-email.dto';
import { WorkspaceInviteEmailDTO } from './dto/workspace-invite-email.dto';

export abstract class EmailProducer {
  protected jobOptions = {
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    removeOnComplete: true,
    removeOnFail: 50,
  };

  abstract sendWelcomeEmail(data: WelcomeEmailDTO): Promise<void>;
  abstract sendVerificationEmail(data: VerificationEmailDTO): Promise<void>;
  abstract sendForgotPasswordEmail(data: ForgotPasswordEmailDTO): Promise<void>;
  abstract sendOrganizationInviteEmail(
    data: OrganizationInviteEmailDTO,
  ): Promise<void>;
  abstract sendWorkspaceInviteEmail(
    data: WorkspaceInviteEmailDTO,
  ): Promise<void>;
  abstract sendEarlyAccessActivationEmail(
    data: EarlyAccessActivationEmailDTO,
  ): Promise<void>;
}
