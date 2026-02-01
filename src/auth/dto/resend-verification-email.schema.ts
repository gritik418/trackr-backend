import { z } from 'zod';

const resendVerificationEmailSchema = z.object({
  email: z.email('Please enter a valid email address'),
});

export type ResendVerificationEmailDto = z.infer<
  typeof resendVerificationEmailSchema
>;

export default resendVerificationEmailSchema;
