export interface WorkspaceOverview {
  workspaceId: string;
  projectsCount: number;
  membersCount: number;

  tasks: { status: string; count: number }[];

  completionRate: number;

  velocity: WorkspaceVelocity;

  graphs: WorkspaceGraphs;
}

export interface WorkspaceVelocity {
  tasksCompletedLast7Days: number;
  tasksCompletedLast14Days: number;
  tasksCompletedLast30Days: number;
  avgTasksPerDay: number;
}

export interface WorkspaceGraphs {
  taskStatusDistribution: {
    status: string;
    count: number;
  }[];

  tasksCompletedOverTime: {
    date: string;
    count: number;
  }[];

  tasksCreatedVsCompleted: {
    date: string;
    created: number;
    completed: number;
  }[];
}
