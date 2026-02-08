import { z } from 'zod';

export const assignTaskSchema = z.object({
  userId: z.string().cuid('Invalid User ID'),
});

export type AssignTaskDto = z.infer<typeof assignTaskSchema>;
