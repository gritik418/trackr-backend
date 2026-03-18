import { EarlyAccessActivationEmailDTO } from './dto/early-access-activation-email.dto';
import { ForgotPasswordEmailDTO } from './dto/forgot-password-email.dto';
import { OrganizationInviteEmailDTO } from './dto/organization-invite-email.dto';
import { VerificationEmailDTO } from './dto/verification-email.dto';
import { WelcomeEmailDTO } from './dto/welcome-email.dto';
import { WorkspaceInviteEmailDTO } from './dto/workspace-invite-email.dto';

export interface SendEmailParams<T> {
  templateName: string;
  to: string;
  subject: string;
  data: T;
  text: string;
}

export interface IEmailProducer {
  sendWelcomeEmail(data: WelcomeEmailDTO): Promise<void>;
  sendVerificationEmail(data: VerificationEmailDTO): Promise<void>;
  sendForgotPasswordEmail(data: ForgotPasswordEmailDTO): Promise<void>;
  sendOrganizationInviteEmail(data: OrganizationInviteEmailDTO): Promise<void>;
  sendWorkspaceInviteEmail(data: WorkspaceInviteEmailDTO): Promise<void>;
  sendEarlyAccessActivationEmail(
    data: EarlyAccessActivationEmailDTO,
  ): Promise<void>;
}
