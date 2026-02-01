import { z } from 'zod';

const forgotPasswordSchema = z.object({
  email: z.email('Please enter a valid email address'),
});

export type ForgotPasswordDto = z.infer<typeof forgotPasswordSchema>;

export default forgotPasswordSchema;
