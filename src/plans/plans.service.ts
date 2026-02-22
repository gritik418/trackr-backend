import { Injectable } from '@nestjs/common';

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

export interface Plan {
  id: string;
  name: string;
  description: string;
  price: number;
  interval: 'month' | 'year';
  features: PlanFeature[];
  limits: PlanLimits;
  isMostPopular?: boolean;
}

@Injectable()
export class PlansService {
  private readonly plans: Plan[] = [
    {
      id: 'free',
      name: 'Free',
      description: 'Perfect for individuals and small teams starting out.',
      price: 0,
      interval: 'month',
      features: [
        { text: '1 Organization', included: true },
        { text: '2 Workspaces', included: true },
        { text: '5 Projects per Workspace', included: true },
        { text: 'Basic Analytics', included: true },
        { text: 'Audit Logs (7 days)', included: true },
        { text: 'Advanced Analytics', included: false },
        { text: 'PDF Export', included: false },
        { text: 'Custom Branding', included: false },
      ],
      limits: {
        maxOrganizations: 1,
        maxWorkspacesPerOrg: 2,
        maxProjectsPerWorkspace: 5,
        maxTasksPerProject: 50,
        maxMembersPerOrg: 5,
        auditLogRetentionDays: 7,
        isLogExportAvailable: false,
      },
    },
    {
      id: 'pro',
      name: 'Pro',
      description: 'Ideal for growing teams that need more power.',
      price: 19,
      interval: 'month',
      isMostPopular: true,
      features: [
        { text: '3 Organizations', included: true },
        { text: 'Unlimited Workspaces', included: true },
        { text: 'Unlimited Projects', included: true },
        { text: 'Advanced Analytics', included: true },
        { text: 'Audit Logs (30 days)', included: true },
        { text: 'PDF Export', included: true },
        { text: 'Custom Branding', included: true },
        { text: 'SAML SSO', included: false },
      ],
      limits: {
        maxOrganizations: 3,
        maxWorkspacesPerOrg: -1,
        maxProjectsPerWorkspace: -1,
        maxTasksPerProject: -1,
        maxMembersPerOrg: 50,
        auditLogRetentionDays: 30,
        isLogExportAvailable: true,
      },
    },
    {
      id: 'enterprise',
      name: 'Enterprise',
      description: 'Advanced features and support for large organizations.',
      price: 99,
      interval: 'month',
      features: [
        { text: 'Unlimited Organizations', included: true },
        { text: 'Everything in Pro', included: true },
        { text: 'Audit Logs (365 days)', included: true },
        { text: 'SAML SSO', included: true },
        { text: 'Custom SLAs', included: true },
        { text: 'Dedicated Support', included: true },
      ],
      limits: {
        maxOrganizations: -1,
        maxWorkspacesPerOrg: -1,
        maxProjectsPerWorkspace: -1,
        maxTasksPerProject: -1,
        maxMembersPerOrg: -1,
        auditLogRetentionDays: 365,
        isLogExportAvailable: true,
      },
    },
  ];

  async getPlans(): Promise<Plan[]> {
    return this.plans;
  }
}
