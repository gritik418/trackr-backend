import { z } from 'zod';

export const assignTaskSchema = z.object({
  userIds: z.array(z.cuid('Invalid User ID')),
});

export type AssignTaskDto = z.infer<typeof assignTaskSchema>;
