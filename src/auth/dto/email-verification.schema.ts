import { z } from 'zod';

const emailVerificationSchema = z.object({
  email: z.email('Please enter a valid email address'),
  otp: z
    .string()
    .min(1, 'OTP cannot be empty')
    .length(6, 'OTP must be exactly 6 digits')
    .regex(/^\d{6}$/, 'OTP must contain only digits'),
});

export type EmailVerificationDto = z.infer<typeof emailVerificationSchema>;

export default emailVerificationSchema;
