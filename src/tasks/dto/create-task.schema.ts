import { z } from 'zod';

const taskStatusEnum = z.enum([
  'TODO',
  'DONE',
  'BLOCKED',
  'ON_HOLD',
  'CANCELED',
  'IN_REVIEW',
  'IN_PROGRESS',
]);

const createTaskSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required.')
    .max(150, "Title can't exceed 150 characters."),
  description: z
    .string()
    .max(1000, "Description can't exceed 1000 characters.")
    .optional(),
  status: taskStatusEnum.optional(),
  assignedToId: z.cuid().optional(),
  categoryId: z.cuid().optional(),
});

export type CreateTaskDto = z.infer<typeof createTaskSchema>;

export default createTaskSchema;
