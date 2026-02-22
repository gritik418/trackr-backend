import { PrismaClient } from 'generated/prisma/client';
import { PlanCreateInput } from 'generated/prisma/models';

const plans: PlanCreateInput[] = [
  {
    id: 'free',
    name: 'Free',
    type: 'FREE',
    description: 'Perfect for individuals starting out.',
    price: 0,
    currency: 'USD',
    interval: 'MONTH',
    isActive: true,
    isMostPopular: false,
    features: [
      { text: '2 Workspaces', included: true },
      { text: '5 Projects per Workspace', included: true },
      { text: '10 Tasks per Project', included: true },
      { text: 'Basic Analytics', included: true },
      { text: 'Advanced Analytics', included: false },
      { text: 'Audit Logs', included: false },
      { text: 'Custom Branding', included: false },
    ],
    limits: {
      maxOrgsPerUser: 1,
      maxWorkspacesPerOrg: 1,
      maxProjectsPerWorkspace: 5,
      maxTasksPerProject: 10,
      auditLogRetentionDays: 30,
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  },
  {
    id: 'early-access',
    name: 'Early Access',
    type: 'EARLY_ACCESS',
    description: 'Get early access and try all features for free.',
    price: 0,
    currency: 'USD',
    interval: null,
    isActive: true,
    isMostPopular: false,
    features: [
      { text: 'Unlimited Workspaces', included: true },
      { text: 'Unlimited Projects', included: true },
      { text: 'Unlimited Tasks', included: true },
      { text: 'Advanced Analytics', included: true },
      { text: 'Audit Logs', included: true },
      { text: 'Custom Branding', included: false },
    ],
    limits: {
      maxOrgsPerUser: 1,
      maxWorkspacesPerOrg: 2,
      maxProjectsPerWorkspace: 10,
      maxTasksPerProject: 50,
      auditLogRetentionDays: 90,
    },

    createdAt: new Date(),
    updatedAt: new Date(),
  },
];

export async function seedPlans(prisma: PrismaClient) {
  for (const plan of plans) {
    await prisma.plan.upsert({
      where: { id: plan.id },
      create: plan,
      update: plan,
    });
  }
  console.log('✅ Plans seeded successfully');
}
