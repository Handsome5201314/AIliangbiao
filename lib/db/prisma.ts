import { PrismaClient } from '@prisma/client';

// 声明全局 Prisma 变量，防止开发环境下热重载导致连接数耗尽
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['query', 'error', 'warn'], // 开发时可以看 SQL 语句
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
