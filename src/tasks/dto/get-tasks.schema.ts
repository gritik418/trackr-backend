import { z } from 'zod';
import { TaskStatus, TaskPriority } from 'generated/prisma/enums';

enum ExtraTaskStatus {
  ALL = 'ALL',
}

export const TaskStatusWithAll = {
  ...TaskStatus,
  ...ExtraTaskStatus,
};

type TaskStatusWithAll =
  (typeof TaskStatusWithAll)[keyof typeof TaskStatusWithAll];

export const getTasksSchema = z.object({
  priority: z.enum(TaskPriority).optional(),
  tag: z.string().optional(),
  page: z.coerce.number().optional().default(1),
  limit: z.coerce.number().optional().default(10),
  search: z.string().optional(),
  status: z.enum(TaskStatusWithAll).optional().default(TaskStatusWithAll.ALL),
  sortBy: z
    .enum(['createdAt', 'updatedAt', 'deadline'])
    .optional()
    .default('updatedAt'),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc'),
});

export type GetTasksDto = z.infer<typeof getTasksSchema>;
