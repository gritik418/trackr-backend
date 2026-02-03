import { z } from 'zod';

const updateUserSchema = z.object({
  name: z
    .string()
    .min(3, 'Name must be at least 3 characters')
    .max(50, 'Name must be less than 50 characters')
    .optional(),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be less than 30 characters')
    .regex(
      /^[a-zA-Z0-9_]+$/,
      'Username can only contain letters, numbers, and underscores',
    )
    .optional(),
  avatarFile: z
    .instanceof(File)
    .refine(
      (file) => file.size <= 2 * 1024 * 1024,
      'Image must be less than 2MB',
    )
    .refine(
      (file) => file.type.startsWith('image/'),
      'Only image files are allowed',
    )
    .optional(),
});
export type UpdateUserDto = z.infer<typeof updateUserSchema>;

export default updateUserSchema;
