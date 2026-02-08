import { z } from 'zod';
import { TaskStatus, TaskPriority } from 'generated/prisma/enums';

export const getTasksSchema = z.object({
  status: z.enum(TaskStatus).optional(),
  priority: z.enum(TaskPriority).optional(),
  assignedToId: z.cuid('Invalid User ID').optional(),
  tag: z.string().optional(),
});

export type GetTasksDto = z.infer<typeof getTasksSchema>;
