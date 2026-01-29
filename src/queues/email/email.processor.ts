import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { EMAIL_QUEUE, EMAIL_JOBS } from './email.constants';
import * as nodemailer from 'nodemailer';
import { VerificationEmailDTO } from './dto/verification-email.dto';

@Processor(EMAIL_QUEUE)
export class EmailProcessor extends WorkerHost {
  private transporter: nodemailer.Transporter;

  constructor() {
    super();
    this.transporter = nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: 'petra41@ethereal.email',
        pass: '8zcqcBkGEGxNFsnux5',
      },
    });
  }

  async process(job: Job) {
    switch (job.name) {
      case EMAIL_JOBS.SEND_VERIFICATION:
        console.log(job.name, job.data);
        this.sendVerification(job.data);
        break;
    }
  }

  private async sendVerification(data: VerificationEmailDTO) {
    await this.transporter.sendMail({
      from: `"Trackr" <noreply@trackr.com>`,
      to: data.email,
      subject: `✅ Verify your Trackr account`,
      html: `<h1>Verify your Account ${data.name}</h1>`,
      text: `Hello ${data.name},\n\nPlease verify your email by clicking this link:\n${data.name}\n\nIf you didn't create an account, ignore this email.\n\nBest,\nTask Management Team`,
    });
  }
}
