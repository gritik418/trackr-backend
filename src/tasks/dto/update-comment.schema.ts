import { z } from 'zod';

export const updateCommentSchema = z.object({
  content: z.string().min(1, 'Comment content is required'),
});

export type UpdateCommentDto = z.infer<typeof updateCommentSchema>;
