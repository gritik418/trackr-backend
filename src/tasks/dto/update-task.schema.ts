import { z } from 'zod';
import { TaskStatus, TaskPriority } from 'generated/prisma/enums';

export const updateTaskSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required.')
    .max(150, "Title can't exceed 150 characters.")
    .optional(),

  description: z.string().optional().nullable(),
  status: z.enum(TaskStatus).optional(),
  priority: z.enum(TaskPriority).optional(),
  deadline: z.coerce.date().optional().nullable(),
  tag: z.string().optional().nullable(),

  categoryId: z.cuid('Invalid Category ID').optional().nullable(),
  assignedToIds: z.array(z.cuid('Invalid User ID')).optional(),
});

export type UpdateTaskDto = z.infer<typeof updateTaskSchema>;
