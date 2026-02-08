import { PrismaClient } from '@prisma/client';

let prisma: PrismaClient;

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });
  }
  return prisma;
}

export async function setupTestDatabase(): Promise<void> {
  prisma = getPrismaClient();
  await prisma.$connect();
}

export async function cleanDatabase(): Promise<void> {
  const prisma = getPrismaClient();

  await prisma.notification.deleteMany({});
  await prisma.invite.deleteMany({});
  await prisma.task.deleteMany({});
  await prisma.list.deleteMany({});
  await prisma.label.deleteMany({});
  await prisma.boardMember.deleteMany({});
  await prisma.board.deleteMany({});
  await prisma.user.deleteMany({});
}

export async function teardownTestDatabase(): Promise<void> {
  if (prisma) {
    await prisma.$disconnect();
  }
}
