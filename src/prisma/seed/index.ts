import { seedPlans } from './plans.seed';
import { PrismaService } from '../prisma.service';

async function main() {
  const prismaService = new PrismaService();
  await seedPlans(prismaService);
  await prismaService.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
