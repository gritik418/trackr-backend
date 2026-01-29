import { RefinementCtx, z } from 'zod';

const registerSchema = z
  .object({
    name: z
      .string()
      .min(1, 'Name is required')
      .min(3, 'Name must be at least 3 characters')
      .max(50, 'Name must be less than 50 characters'),

    username: z
      .string()
      .min(1, 'Username is required')
      .min(3, 'Username must be at least 3 characters')
      .max(30, 'Username must be less than 30 characters')
      .regex(
        /^[a-zA-Z0-9_]+$/,
        'Username can only contain letters, numbers, and underscores',
      ),
    email: z.email('Please enter a valid email address'),
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

    passwordConfirmation: z
      .string()
      .min(1, 'Password confirmation is required.'),
  })
  .superRefine(({ password, passwordConfirmation }, ctx: RefinementCtx) => {
    if (passwordConfirmation !== password) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Password confirmation must match the password.',
        path: ['passwordConfirmation'],
      });
    }
  });

export type RegisterDto = z.infer<typeof registerSchema>;

export default registerSchema;
