import { ProjectNature, ProjectStatus } from 'generated/prisma/enums';
import z from 'zod';

enum ExtraProjectStatus {
  ALL = 'ALL',
}

enum ExtraProjectNature {
  ALL = 'ALL',
}

export const ProjectStatusWithAll = {
  ...ProjectStatus,
  ...ExtraProjectStatus,
};

export const ProjectNatureWithAll = {
  ...ProjectNature,
  ...ExtraProjectNature,
};

type ProjectStatusWithAll =
  (typeof ProjectStatusWithAll)[keyof typeof ProjectStatusWithAll];

type ProjectNatureWithAll =
  (typeof ProjectNatureWithAll)[keyof typeof ProjectNatureWithAll];

export const getProjectsSchema = z.object({
  search: z.string().optional().default(''),
  status: z.enum(ProjectStatusWithAll).optional(),
  nature: z.enum(ProjectNatureWithAll).optional(),
});

export type GetProjectsDto = z.infer<typeof getProjectsSchema>;
