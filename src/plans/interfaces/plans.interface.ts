export interface PlanFeature {
  text: string;
  included: boolean;
}

export interface PlanLimits {
  maxOrganizations: number | null; // null = unlimited
  maxWorkspacesPerOrg: number | null; // null = unlimited
  maxProjectsPerWorkspace: number | null; // null = unlimited
  maxTasksPerProject: number | null; // null = unlimited
  maxMembersPerOrg: number | null; // null = unlimited
  auditLogRetentionDays: number | null; // null = unlimited
  isLogExportAvailable: boolean;
}
