import { z } from 'zod';
import { TaskStatus, TaskPriority } from 'generated/prisma/enums';

const createTaskSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required.')
    .max(150, "Title can't exceed 150 characters."),

  description: z.string().optional().nullable(),
  status: z.enum(TaskStatus).default(TaskStatus.TODO),
  priority: z.enum(TaskPriority).default(TaskPriority.MEDIUM),
  deadline: z.coerce.date().optional().nullable(),
  projectId: z.cuid('Invalid Project ID'),

  assignedToId: z.cuid('Invalid User ID').optional().nullable(),
  categoryId: z.cuid('Invalid Category ID').optional().nullable(),

  links: z
    .array(
      z.object({
        title: z.string().max(150).optional(),
        url: z.url('Invalid URL'),
      }),
    )
    .optional(),
});

export type CreateTaskDto = z.infer<typeof createTaskSchema>;

export default createTaskSchema;
