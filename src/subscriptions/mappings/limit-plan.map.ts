import { Limit, PlanLimits } from '../enums/limit.enum';

export const LIMIT_TO_PLAN_FIELD: Record<
  Limit,
  (typeof PlanLimits)[keyof typeof PlanLimits]
> = {
  [Limit.MAX_WORKSPACES]: PlanLimits.maxWorkspaces,
  [Limit.MAX_PROJECTS_PER_WORKSPACE]: PlanLimits.maxProjectsPerWorkspace,
  [Limit.MAX_TASKS_PER_PROJECT]: PlanLimits.maxTasksPerProject,
  [Limit.MAX_MEMBERS_PER_ORG]: PlanLimits.maxMembersPerOrg,
  [Limit.AUDIT_LOG_RETENTION_DAYS]: PlanLimits.auditLogRetentionDays,
  [Limit.IS_LOG_EXPORT_AVAILABLE]: PlanLimits.isLogExportAvailable,
};
