import { z } from 'zod';
import { TaskStatus, TaskPriority } from 'generated/prisma/enums';

export const getTasksSchema = z.object({
  status: z.enum(TaskStatus).optional(),
  priority: z.enum(TaskPriority).optional(),
  assignedToId: z.string().cuid('Invalid User ID').optional(),
});

export type GetTasksDto = z.infer<typeof getTasksSchema>;
