import { z } from 'zod';

export const unassignTaskSchema = z.object({
  userIds: z.array(z.cuid('Invalid User ID')),
});

export type UnassignTaskDto = z.infer<typeof unassignTaskSchema>;
