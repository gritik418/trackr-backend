import { Injectable } from '@nestjs/common';
import { EMAIL_JOBS, emailSubject } from '../email.constants';
import templateNames from '../constants/template-names';
import { join } from 'path';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';
import nodemailer from 'nodemailer';
import handlebars from 'handlebars';
import { SendEmailParams } from '../email.interface';
import { ConfigService } from '@nestjs/config';
import { EmailProducer } from '../email.producer';

@Injectable()
export class DirectEmailService extends EmailProducer {
  constructor(private readonly configService: ConfigService) {
    super();
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });
  }

  private templates = new Map<string, handlebars.TemplateDelegate>();
  private transporter: nodemailer.Transporter;
  private fromEmail: string = "'Trackr' <noreply@trackr.com>";

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

    await this.transporter.sendMail({
      from: this.fromEmail,
      to,
      subject,
      html,
      text,
    });
  }

  async sendWelcomeEmail(data: any) {
    this.sendEmail({
      to: data.email,
      data: data,
      subject: emailSubject[EMAIL_JOBS.WELCOME],
      templateName: templateNames.welcome,
      text: `Hello ${data.name},\n\nWelcome to Trackr! We're excited to have you on board.\n\nBest,\nTrackr Team`,
    });
  }

  async sendVerificationEmail(data: any) {
    this.sendEmail({
      to: data.email,
      data: data,
      subject: emailSubject[EMAIL_JOBS.SEND_VERIFICATION],
      templateName: templateNames.verification,
      text: `Hello ${data.name},\n\nPlease verify your email by clicking this link:\n${data.verificationToken}\n\nIf you didn't create an account, ignore this email.\n\nBest,\nTrackr Team`,
    });
  }

  async sendForgotPasswordEmail(data: any) {
    this.sendEmail({
      to: data.email,
      data: data,
      subject: emailSubject[EMAIL_JOBS.FORGOT_PASSWORD],
      templateName: templateNames.forgotPassword,
      text: `Hello ${data.name},\n\nReset your password:\n${data.resetLink}\n\nThis link expires in 1 hour.\n\nBest,\nTrackr Team`,
    });
  }

  async sendOrganizationInviteEmail(data: any) {
    this.sendEmail({
      to: data.email,
      data: data,
      subject: emailSubject[EMAIL_JOBS.ORGANIZATION_INVITE],
      templateName: templateNames.organizationInvite,
      text: `Hello,\n\n${data.inviterName} has invited you to join ${data.organizationName} on Trackr.\n\nAccept your invitation:\n${data.inviteLink}\n\nBest,\nTrackr Team`,
    });
  }

  async sendWorkspaceInviteEmail(data: any) {
    this.sendEmail({
      to: data.email,
      data: data,
      subject: emailSubject[EMAIL_JOBS.WORKSPACE_INVITE],
      templateName: templateNames.workspaceInvite,
      text: `Hello,\n\n${data.inviterName} has invited you to join ${data.workspaceName} on Trackr.\n\nAccept your invitation:\n${data.inviteLink}\n\nBest,\nTrackr Team`,
    });
  }

  async sendEarlyAccessActivationEmail(data: any) {
    this.sendEmail({
      to: data.email,
      data: data,
      subject: emailSubject[EMAIL_JOBS.SEND_EARLY_ACCESS_ACTIVATION],
      templateName: templateNames.earlyAccessActivation,
      text: `Hello ${data.name},\n\nYour Early Access Plan on Trackr is now active. Thank you for being an early believer!\n\nBest,\nTrackr Team`,
    });
  }
}
