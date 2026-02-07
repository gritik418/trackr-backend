export interface SendEmailParams<T> {
  templateName: string;
  to: string;
  subject: string;
  data: T;
  text: string;
}
