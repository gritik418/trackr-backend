import { Processor, WorkerHost } from '@nestjs/bullmq';
import { OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Job } from 'bullmq';
import handlebars from 'handlebars';
import { join } from 'path';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import templateNames from './constants/template-names';
import { EarlyAccessActivationEmailDTO } from './dto/early-access-activation-email.dto';
import { ForgotPasswordEmailDTO } from './dto/forgot-password-email.dto';
import { OrganizationInviteEmailDTO } from './dto/organization-invite-email.dto';
import { VerificationEmailDTO } from './dto/verification-email.dto';
import type { WelcomeEmailDTO } from './dto/welcome-email.dto';
import { WorkspaceInviteEmailDTO } from './dto/workspace-invite-email.dto';
import { EMAIL_JOBS, EMAIL_QUEUE, emailSubject } from './email.constants';
import { SendEmailParams } from './email.interface';
import { Resend } from 'resend';

@Processor(EMAIL_QUEUE)
export class EmailProcessor extends WorkerHost implements OnModuleInit {
  // protected transporter: nodemailer.Transporter;
  protected fromEmail: string = "'Trackr' <noreply@trackr.com>";
  protected templates = new Map<string, handlebars.TemplateDelegate>();

  protected resend: Resend | null = null;

  constructor(private configService: ConfigService) {
    super();

    // this.transporter = nodemailer.createTransport({
    //   service: 'gmail',
    //   auth: {
    //     user: this.configService.get<string>('SMTP_USER'),
    //     pass: this.configService.get<string>('SMTP_PASS'),
    //   },
    // });

    this.resend = new Resend(this.configService.get<string>('RESEND_API_KEY'));
  }

  async onModuleInit() {
    await this.loadAllTemplates();
  }

  private getTemplatePath(template: string): string {
    const distPath = join(
      process.cwd(),
      'dist',
      'queues',
      'email',
      'templates',
      `${template}.hbs`,
    );

    const srcPath = join(
      process.cwd(),
      'src',
      'queues',
      'email',
      'templates',
      `${template}.hbs`,
    );

    return existsSync(distPath) ? distPath : srcPath;
  }

  private async loadAllTemplates() {
    try {
      const templatesToLoad = Object.values(templateNames) as string[];

      for (const templateName of templatesToLoad) {
        try {
          const templatePath = this.getTemplatePath(templateName);
          const source = await readFile(templatePath, { encoding: 'utf-8' });
          this.templates.set(templateName, handlebars.compile(source));
        } catch (error) {
          console.warn(`⚠️ Failed to load template ${templateName}`);
        }
      }
    } catch (error) {
      console.error('❌ Failed to load templates:', error);
    }
  }

  async process(job: Job) {
    switch (job.name) {
      case EMAIL_JOBS.SEND_VERIFICATION: {
        const data = job.data as VerificationEmailDTO;
        this.sendEmail({
          to: data.email,
          data: data,
          subject: emailSubject[EMAIL_JOBS.SEND_VERIFICATION],
          templateName: templateNames.verification,
          text: `Hello ${data.name},\n\nPlease verify your email by clicking this link:\n${data.verificationToken}\n\nIf you didn't create an account, ignore this email.\n\nBest,\nTrackr Team`,
        });

        break;
      }

      case EMAIL_JOBS.FORGOT_PASSWORD: {
        const data = job.data as ForgotPasswordEmailDTO;
        this.sendEmail({
          to: data.email,
          data: data,
          subject: emailSubject[EMAIL_JOBS.FORGOT_PASSWORD],
          templateName: templateNames.forgotPassword,
          text: `Hello ${data.name},\n\nReset your password:\n${data.resetLink}\n\nThis link expires in 1 hour.\n\nBest,\nTrackr Team`,
        });
        break;
      }

      case EMAIL_JOBS.ORGANIZATION_INVITE: {
        const data = job.data as OrganizationInviteEmailDTO;
        this.sendEmail({
          to: data.email,
          data: data,
          subject: emailSubject[EMAIL_JOBS.ORGANIZATION_INVITE],
          templateName: templateNames.organizationInvite,
          text: `Hello,\n\n${data.inviterName} has invited you to join ${data.organizationName} on Trackr.\n\nAccept your invitation:\n${data.inviteLink}\n\nBest,\nTrackr Team`,
        });
        break;
      }

      case EMAIL_JOBS.WORKSPACE_INVITE: {
        const data = job.data as WorkspaceInviteEmailDTO;
        this.sendEmail({
          to: data.email,
          data: data,
          subject: emailSubject[EMAIL_JOBS.WORKSPACE_INVITE],
          templateName: templateNames.workspaceInvite,
          text: `Hello,\n\n${data.inviterName} has invited you to join ${data.workspaceName} on Trackr.\n\nAccept your invitation:\n${data.inviteLink}\n\nBest,\nTrackr Team`,
        });
        break;
      }

      case EMAIL_JOBS.WELCOME: {
        const data = job.data as WelcomeEmailDTO;
        this.sendEmail({
          to: data.email,
          data: data,
          subject: emailSubject[EMAIL_JOBS.WELCOME],
          templateName: templateNames.welcome,
          text: `Hello ${data.name},\n\nWelcome to Trackr! We're excited to have you on board.\n\nBest,\nTrackr Team`,
        });
        break;
      }
      case EMAIL_JOBS.SEND_EARLY_ACCESS_ACTIVATION: {
        const data = job.data as EarlyAccessActivationEmailDTO;
        this.sendEmail({
          to: data.email,
          data: data,
          subject: emailSubject[EMAIL_JOBS.SEND_EARLY_ACCESS_ACTIVATION],
          templateName: templateNames.earlyAccessActivation,
          text: `Hello ${data.name},\n\nYour Early Access Plan on Trackr is now active. Thank you for being an early believer!\n\nBest,\nTrackr Team`,
        });
        break;
      }

      default:
        throw new Error(`Unhandled email job: ${job.name}`);
    }
  }

  private async sendEmail<T>({
    templateName,
    to,
    subject,
    text,
    data,
  }: SendEmailParams<T>) {
    const template = this.templates.get(templateName);
    if (!template) {
      throw new Error(`${templateName} template not loaded`);
    }

    const html = template(data);

    try {
      // await this.transporter.sendMail({
      //   from: this.fromEmail,
      //   to,
      //   subject,
      //   html,
      //   text,
      // });

      if (!this.resend) {
        throw new Error('Resend not initialized');
      }

      const { data, error } = await this.resend.emails.send({
        from: this.fromEmail,
        to,
        subject,
        html,
        text,
      });

      if (error) {
        console.error('❌ Failed to send email:', error);
      }

      return { data, error };
    } catch (error) {
      console.error('❌ Failed to send email:', error);
    }
  }
}
