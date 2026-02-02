import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { EMAIL_QUEUE, EMAIL_JOBS } from './email.constants';
import * as nodemailer from 'nodemailer';
import { VerificationEmailDTO } from './dto/verification-email.dto';
import { ConfigService } from '@nestjs/config';
import { join } from 'path';
import { readFile } from 'fs/promises';
import handlebars from 'handlebars';
import { OnModuleInit } from '@nestjs/common';
import { existsSync } from 'fs';
import templateNames from './constants/template-names';
import { ForgotPasswordEmailDTO } from './dto/forgot-password-email.dto';

@Processor(EMAIL_QUEUE)
export class EmailProcessor extends WorkerHost implements OnModuleInit {
  private transporter: nodemailer.Transporter;
  private templates = new Map<string, handlebars.TemplateDelegate>();

  constructor(private configService: ConfigService) {
    super();

    this.transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: this.configService.get<string>('SMTP_USER'),
        pass: this.configService.get<string>('SMTP_PASS'),
      },
    });
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
          console.warn(
            `⚠️ Failed to load template ${templateName}:`,
            error.message,
          );
        }
      }
    } catch (error) {
      console.error('❌ Failed to load templates:', error);
    }
  }

  async process(job: Job) {
    switch (job.name) {
      case EMAIL_JOBS.SEND_VERIFICATION:
        this.sendVerification(job.data);
        break;

      case EMAIL_JOBS.FORGOT_PASSWORD:
        this.sendForgotPassword(job.data);
    }
  }

  private async sendVerification(data: VerificationEmailDTO) {
    const template = this.templates.get(templateNames.verification);
    if (!template) {
      throw new Error('Verification template not loaded');
    }

    const html = template(data);

    await this.transporter.sendMail({
      from: `"Trackr" <noreply@trackr.com>`,
      to: data.email,
      subject: `✅ Verify your Trackr account`,
      html,
      text: `Hello ${data.name},\n\nPlease verify your email by clicking this link:\n${data.name}\n\nIf you didn't create an account, ignore this email.\n\nBest,\nTrackr Team`,
    });
  }

  private async sendForgotPassword(data: ForgotPasswordEmailDTO) {
    const template = this.templates.get(templateNames.forgotPassword);
    if (!template) {
      throw new Error('Forgot Password template not loaded');
    }

    const html = template(data);

    await this.transporter.sendMail({
      from: `"Trackr" <noreply@trackr.com>`,
      to: data.email,
      subject: `🔐 Reset your Trackr password`,
      html,
      text: `Hello ${data.name},\n\nReset your password:\n${data.resetLink}\n\nThis link expires in 1 hour.\n\nBest,\nTrackr Team`,
    });
  }
}
