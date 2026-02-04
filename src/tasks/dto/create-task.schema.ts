import { z } from 'zod';

const taskStatusEnum = z.enum([
  'TODO',
  'IN_PROGRESS',
  'IN_REVIEW',
  'BLOCKED',
  'ON_HOLD',
  'DONE',
  'CANCELED',
]);

const taskPriorityEnum = z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']);

const createTaskSchema = z.object({
  title: z
    .string()
    .min(1, 'Title is required.')
    .max(150, "Title can't exceed 150 characters."),

  description: z.string().optional(),
  status: taskStatusEnum.optional(),
  priority: taskPriorityEnum.optional(),
  deadline: z.iso.datetime().optional(),

  assignedToId: z.cuid().optional(),

  categoryId: z.cuid().optional(),

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
