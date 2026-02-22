export interface PlanFeature {
  text: string;
  included: boolean;
}

export interface PlanLimits {
  maxOrganizations: number;
  maxWorkspacesPerOrg: number;
  maxProjectsPerWorkspace: number;
  maxTasksPerProject: number;
  maxMembersPerOrg: number;
  auditLogRetentionDays: number;
  isLogExportAvailable: boolean;
}
