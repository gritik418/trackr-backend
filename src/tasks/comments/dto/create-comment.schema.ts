import { z } from 'zod';

export const createCommentSchema = z.object({
  content: z.string().min(1, 'Comment content is required'),
});

export type CreateCommentDto = z.infer<typeof createCommentSchema>;
