import { RefinementCtx, z } from 'zod';

const changePasswordSchema = z
  .object({
    oldPassword: z
      .string()
      .min(1, 'Old Password is required.')
      .min(8, 'Old Password must be at least 8 characters long.')
      .max(20, "Old Password can't exceed 20 characters.")
      .regex(
        /[A-Z]/,
        'Old Password must contain at least one uppercase letter.',
      )
      .regex(
        /[a-z]/,
        'Old Password must contain at least one lowercase letter.',
      )
      .regex(/[0-9]/, 'Old Password must contain at least one number.')
      .regex(
        /[\W_]/,
        'Old Password must contain at least one special character (e.g., @, #, $, etc.).',
      ),
    password: z
      .string()
      .min(1, 'Password is required.')
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
  .superRefine(
    ({ oldPassword, password, passwordConfirmation }, ctx: RefinementCtx) => {
      if (passwordConfirmation !== password) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Password confirmation must match the password.',
          path: ['passwordConfirmation'],
        });
      }
      if (oldPassword === password) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'New password must be different from old password.',
          path: ['password'],
        });
      }
    },
  );

export type ChangePasswordDto = z.infer<typeof changePasswordSchema>;

export default changePasswordSchema;
