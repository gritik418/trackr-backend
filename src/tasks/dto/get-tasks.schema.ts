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

enum ExtraTaskPriority {
  ALL = 'ALL',
}

export const TaskPriorityWithAll = {
  ...TaskPriority,
  ...ExtraTaskPriority,
};

type TaskPriorityWithAll =
  (typeof TaskPriorityWithAll)[keyof typeof TaskPriorityWithAll];

export const getTasksSchema = z.object({
  priority: z
    .enum(TaskPriorityWithAll)
    .optional()
    .default(TaskPriorityWithAll.ALL),
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
