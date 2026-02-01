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
    await this.loadTemplates();
  }

  private getTemplatePath(template: string): string {
    const distPath = join(__dirname, 'templates', `${template}.hbs`);
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

  private async loadTemplates() {
    try {
      const templatePath = this.getTemplatePath('verification');
      const source = await readFile(templatePath, { encoding: 'utf-8' });
      this.templates.set('verification', handlebars.compile(source));
      console.log('✅ Email templates loaded');
    } catch (error) {
      console.error('❌ Failed to load templates:', error);
    }
  }

  async process(job: Job) {
    switch (job.name) {
      case EMAIL_JOBS.SEND_VERIFICATION:
        this.sendVerification(job.data);
        break;
    }
  }

  private async sendVerification(data: VerificationEmailDTO) {
    const template = this.templates.get('verification');
    if (!template) {
      throw new Error('Verification template not loaded');
    }

    const html = template(data);

    await this.transporter.sendMail({
      from: `"Trackr" <noreply@trackr.com>`,
      to: data.email,
      subject: `✅ Verify your Trackr account`,
      html,
      text: `Hello ${data.name},\n\nPlease verify your email by clicking this link:\n${data.name}\n\nIf you didn't create an account, ignore this email.\n\nBest,\nTask Management Team`,
    });
  }
}
