import { ProjectNature, ProjectStatus } from 'generated/prisma/enums';

export interface ProjectOverview {
  id: string;
  name: string;
  description: string;
  status: ProjectStatus;
  nature: ProjectNature;
  ownerId: string;
  createdAt: Date;
  updatedAt: Date;

  membersCount: number;

  taskStatusCount?: ProjectTaskStatusCount;

  velocity?: ProjectVelocity;
}

export interface ProjectTaskStatusCount {
  total: number;
  todo: number;
  inProgress: number;
  inReview: number;
  onHold: number;
  done: number;
  canceled: number;
  blocked: number;
}

export interface ProjectVelocity {
  weeklyCompleted: number;
  completionRate: number;
  last7Days: {
    date: string;
    completed: number;
  }[];
}
