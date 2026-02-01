import { z } from 'zod';

const loginSchema = z.object({
  identifier: z.string().min(1, 'Email or username is required.'),
  password: z
    .string()
    .min(1, 'Password is required')
    .min(8, 'Password must be at least 8 characters long.')
    .max(20, "Password can't exceed 20 characters.")
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter.')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter.')
    .regex(/[0-9]/, 'Password must contain at least one number.')
    .regex(
      /[\W_]/,
      'Password must contain at least one special character (e.g., @, #, $, etc.).',
    ),
});

export type LoginDto = z.infer<typeof loginSchema>;

export default loginSchema;
